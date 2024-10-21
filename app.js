const express = require("express");
const app = express();
const port = 3000;
const logger = require("morgan");
const path = require("path");
const db = require("./db/db_connection");
const axios = require("axios");
const { GoogleGenerativeAI } = require('@google/generative-ai');
const airNowApiKey = process.env.AIRNOW_API_KEY;
const meersensKey = process.env.MEERSENS_API_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(geminiApiKey);

app.use(logger("dev"));
app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");  
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "home.html"));
});

const getPollutionInfo = (zipCode, airQualityData) => {
    const aqi = airQualityData.index.value;
    let category, healthEffects, cautionaryStatement, causes;

    if (aqi <= 50) {
        category = "Good";
        healthEffects = "Air quality is considered satisfactory, and air pollution poses little or no risk.";
        cautionaryStatement = "None";
        causes = "Low levels of air pollutants due to favorable weather conditions or low emissions.";
    } else if (aqi <= 100) {
        category = "Moderate";
        healthEffects = "Air quality is acceptable; however, for some pollutants there may be a moderate health concern for a very small number of people who are unusually sensitive to air pollution.";
        cautionaryStatement = "Active children and adults, and people with respiratory disease, such as asthma, should limit prolonged outdoor exertion.";
        causes = "Slight increase in pollutants due to weather conditions or moderate emissions from industries or vehicles.";
    } else if (aqi <= 150) {
        category = "Unhealthy for Sensitive Groups";
        healthEffects = "Members of sensitive groups may experience health effects. The general public is not likely to be affected.";
        cautionaryStatement = "Active children and adults, and people with respiratory disease, such as asthma, should limit prolonged outdoor exertion.";
        causes = "Increased levels of pollutants, possibly due to weather conditions (e.g., temperature inversions) or higher emissions from industries or vehicles.";
    } else if (aqi <= 200) {
        category = "Unhealthy";
        healthEffects = "Everyone may begin to experience health effects; members of sensitive groups may experience more serious health effects.";
        cautionaryStatement = "Active children and adults, and people with respiratory disease, such as asthma, should avoid prolonged outdoor exertion; everyone else, especially children, should limit prolonged outdoor exertion.";
        causes = "High levels of pollutants, often due to significant industrial emissions, heavy traffic, or unfavorable weather conditions.";
    } else if (aqi <= 300) {
        category = "Very Unhealthy";
        healthEffects = "Health warnings of emergency conditions. The entire population is more likely to be affected.";
        cautionaryStatement = "Active children and adults, and people with respiratory disease, such as asthma, should avoid all outdoor exertion; everyone else, especially children, should limit outdoor exertion.";
        causes = "Very high levels of pollutants, possibly due to major industrial incidents, severe weather conditions trapping pollutants, or a combination of high emissions and unfavorable weather.";
    } else {
        category = "Hazardous";
        healthEffects = "Health alert: everyone may experience more serious health effects.";
        cautionaryStatement = "Everyone should avoid all outdoor exertion.";
        causes = "Extremely high levels of pollutants, often due to major environmental events (e.g., wildfires) or severe industrial accidents.";
    }

    const recommendations = `Based on the current air quality:
    1. ${cautionaryStatement}
    2. Consider using air purifiers indoors.
    3. Stay updated on local air quality reports.
    4. If you have respiratory issues, consult with your healthcare provider for personalized advice.
    5. Support and follow local initiatives to improve air quality.`;

    return `
    Air Quality Information for ZIP code ${zipCode}:
    
    Current AQI: ${aqi.toFixed(2)}
    Category: ${category}
    
    Health Effects:
    ${healthEffects}
    
    Possible Causes:
    ${causes}
    
    Recommendations:
    ${recommendations}
    `;
};

const getGeminiInsights = async (aqi, zipCode) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `
        Act as an environmental health expert. Given the following information:
        - Air Quality Index (AQI): ${aqi}
        - Location: ZIP code ${zipCode}

        Please provide:
        1. A brief assessment of the air quality level
        2. 2-3 specific health recommendations based on this AQI
        3. One practical suggestion for improving local air quality

        Keep the response concise and factual. Format with bullet points.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();

    } catch (error) {
        console.error("Error fetching insights from Gemini:", error);
        return "Unable to generate additional insights at this time. Please consult official health resources for accurate information.";
    }
};

const fetchEnvironmentalData = async (latitude, longitude) => {
    const endpoints = [
        { key: 'airQuality', url: 'https://api.meersens.com/environment/public/air/current' },
        { key: 'noise', url: 'https://api.meersens.com/environment/public/noise/current' },
        { key: 'pollen', url: 'https://api.meersens.com/environment/public/pollen/current' },
        { key: 'uv', url: 'https://api.meersens.com/environment/public/uv/current' },
        { key: 'water', url: 'https://api.meersens.com/environment/public/water/current' }
    ];

    const requests = endpoints.map(async (endpoint) => {
        try {
            const response = await axios.get(endpoint.url, {
                params: {
                    lat: latitude,
                    lng: longitude,
                    health_recommendations: true
                },
                headers: {
                    'apikey': meersensKey
                }
            });
            return { [endpoint.key]: response.data };
        } catch (error) {
            console.error(`Error fetching ${endpoint.key} data:`, error.message);
            return { [endpoint.key]: null };
        }
    });

    return Promise.all(requests).then((results) => {
        return results.reduce((acc, curr) => Object.assign(acc, curr), {});
    });
};

// Your existing helper functions
function latLonToWebMercator(lat, lon) {
    const x = lon * 20037508.34 / 180;
    let y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
    y = y * 20037508.34 / 180;
    return [x, y];
}

function createBoundingBox(x, y, width, height) {
    return {
        xmin: Math.round(x - width / 2),
        xmax: Math.round(x + width / 2),
        ymin: Math.round(y - height / 2),
        ymax: Math.round(y + height / 2)
    };
}

app.get('/getPollutionData', async (req, res) => {
    const zipCode = req.query.zipCode;

    if (!zipCode) {
        return res.status(400).send('ZIP code is required.');
    }

    try {
        const geocodingUrl = `https://api.zippopotam.us/us/${zipCode}`;
        const geoResponse = await axios.get(geocodingUrl);

        if (geoResponse.data && geoResponse.data.places && geoResponse.data.places.length > 0) {
            const latitude = geoResponse.data.places[0].latitude;
            const longitude = geoResponse.data.places[0].longitude;

            const environmentalData = await fetchEnvironmentalData(latitude, longitude);

            const datals = {
                zipCode,
                airQualityData: environmentalData.airQuality || 'No air quality data available for this area.',
                noiseData: environmentalData.noise || 'No noise data available for this area.',
                pollenData: environmentalData.pollen || 'No pollen data available for this area.',
                uvData: environmentalData.uv || 'No UV data available for this area.',
                waterData: environmentalData.water || 'No water quality data available for this area.'
            }

            const pollutionInfo = getPollutionInfo(zipCode, datals.airQualityData);

            // Get insights from Gemini AI
            const geminiInsights = await getGeminiInsights(
                datals.airQualityData.index.value,
                zipCode
            );

            const [x, y] = latLonToWebMercator(latitude, longitude);
            const bbox = createBoundingBox(x, y, 50000, 50000);

            const mapUrl = `https://gispub.epa.gov/airnow/?latitude=${latitude}&longitude=${longitude}&zoom=10`;
            
            res.render('pollutionData', {
                dataList: datals,
                latitude: latitude,
                longitude: longitude,
                mapUrl: mapUrl,
                pollutionInfo: pollutionInfo,
                huggingFaceInsights: geminiInsights
            });

        } else {
            res.status(500).send('Unable to get coordinates for the provided ZIP code.');
        }

    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while fetching environmental data.');
    }
});

// Your existing routes
app.get("/articles", (req, res) => {
    const getarticles = "SELECT * FROM articles ORDER BY date DESC"; 

    db.execute(getarticles, (error, results) => {
        if (error) {
            console.error("Error fetching articles:", error);
            return res.status(500).send("There was an error fetching articles.");
        }
        res.render("articles", { articles: results });
    });
});

app.get("/articles/:article_id", (req, res) => {
    const id = req.params.article_id; 
    const getArticle = "SELECT * FROM articles WHERE article_id = ?"; 

    db.execute(getArticle, [id], (error, results) => {
        if (error || results.length === 0) {
            console.error("Error fetching article:", error);
            return res.status(404).send("Article not found.");
        }
        res.render("article", { article: results[0] });
    });
});

app.get("/articlesub", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "articlesub.html"));
});

app.get("/opportunities", (req, res) => {
    const sql = "SELECT * FROM opportunities ORDER BY date DESC";

    db.execute(sql, (error, results) => {
        if (error) {
            console.error("Error fetching opportunities:", error);
            return res.status(500).send("There was an error fetching opportunities.");
        }
        
        res.render("opportunities", { opportunities: results });
    });
});

app.get("/oppsub", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "oppsub.html"));
});

app.post("/submit-opp", (req, res) => {
    const { first_name, last_name, email, event, description, organization, date } = req.body;
    const osub = `INSERT INTO opportunities (first_name, last_name, email, event, description, organization, date) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.execute(osub, [first_name, last_name, email, event, description, organization, date], (error, result) => {
        if (error) {
            console.error("Database error:", error); 
            return res.status(500).send("There was an error submitting your event.");
        }

        const sql = "SELECT * FROM opportunities ORDER BY date DESC";
        db.execute(sql, (error, results) => {
            if (error) {
                console.error("Error fetching opportunities:", error);
                return res.status(500).send("There was an error fetching opportunities.");
            }
            res.render("opportunities", { opportunities: results });
        });
    });
});

app.get("/opportunities/:opp_id", (req, res) => {
    const oppId = req.params.opp_id; 
    const getOpps = "SELECT * FROM opportunities WHERE opp_id = ?"; 

    db.execute(getOpps, [oppId], (error, results) => {
        if (error || results.length === 0) {
            console.error("Error fetching opportunity:", error);
            return res.status(404).send("Opportunity not found.");
        }
        res.render("opportunity", { opportunity: results[0] });
    });
});

app.post("/submit-article", (req, res) => {
    const { first_name, last_name, email, title, text, institution, date } = req.body;
    const asub = `INSERT INTO articles (first_name, last_name, email, title, text, institution, date) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.execute(asub, [first_name, last_name, email, title, text, institution, date], (error, result) => {
        if (error) {
            console.error("Database error:", error); 
            return res.status(500).send("There was an error submitting your article.");
        }
        const getarticles = "SELECT * FROM articles ORDER BY date DESC"; 

        db.execute(getarticles, (error, results) => {
            if (error) {
                console.error("Error fetching articles:", error);
                return res.status(500).send("There was an error fetching articles.");
            }
            res.render("articles", { articles: results });
        });
    });
});

app.get("/map", (req, res) => {
    res.render("map");
});

app.get("/gallery", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "gallery.html"));
});

app.listen(port, () => {
    console.log(`App server listening on ${port}. (Go to http://localhost:${port})`);
});