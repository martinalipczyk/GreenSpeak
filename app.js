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
const genAI = new GoogleGenerativeAI(geminiApiKey);

app.use(logger("dev"));
app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");  
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "home.html"));
});

const getGeminiInsights = async (aqi, zipCode) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `
        Act as an environmental health expert providing advice to a community member. Given the following information:
        - Air Quality Index (AQI): ${aqi}
        - Location: ZIP code ${zipCode}

        Write a brief, cohesive response that flows naturally and covers:
        1. Your assessment of the current air quality level and what it means for the community
        2. Specific health recommendations appropriate for this AQI level
        3. A practical suggestion for improving local air quality

        Important formatting instructions:
        - Write in clear, flowing paragraphs
        - Use natural transitions between topics
        - Write conversationally but professionally
        - Do not use any special formatting characters
        - Do not use bullet points or numbered lists
        - Keep the total response to 3-4 short paragraphs

        Example structure:
        [First paragraph about current air quality assessment]
        [Second paragraph with health recommendations]
        [Final paragraph with improvement suggestion]`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        
        // Clean up any remaining markdown or special characters
        let cleanText = response.text()
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/`/g, '')
            .replace(/#{1,6}\s/g, '')
            .replace(/•/g, '')
            .replace(/- /g, '')
            .replace(/\n\n+/g, '\n\n'); // Replace multiple newlines with just two

        return cleanText;

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

            // const pollutionInfo = getPollutionInfo(zipCode, datals.airQualityData);

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
                // pollutionInfo: pollutionInfo,
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
    const asub = `INSERT INTO articles (first_name, last_name, email, title, text, institution, date, image) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    db.execute(asub, [first_name, last_name, email, title, text, institution, date, image], (error, result) => {
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

app.get("/home", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "home.html"))
});

app.listen(port, () => {
    console.log(`App server listening on ${port}. (Go to http://localhost:${port})`);
});