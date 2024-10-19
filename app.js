const express = require("express");
const app = express();
const port = 3000;
const logger = require("morgan");
const path = require("path");
const db = require("./db/db_connection");
const axios = require("axios");
const airNowApiKey = process.env.AIRNOW_API_KEY;
const meersensKey = process.env.MEERSENS_API_KEY;


app.use(logger("dev"));
app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");  
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "home.html"));
});

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

// app.post("/submit-opp", (req, res) => {
//     console.log(req.body);
//     const { first_name, last_name, email, event, description, organization, date } = req.body;
//     const osub = `INSERT INTO opportunities (first_name, last_name, email, event, description, organization, date) 
//     VALUES (?, ?, ?, ?, ?, ?, ?)`;

//     db.execute(osub, [first_name, last_name, email, event, description, organization, date], (error, result) => {
//         if (error) {
//             return res.status(500).send("There was an error submitting your event.");
//         }
//         res.send("Event submitted successfully!");
//     });
// });
app.post("/submit-opp", (req, res) => {
    console.log(req.body);
    const { first_name, last_name, email, event, description, organization, date } = req.body;
    const osub = `INSERT INTO opportunities (first_name, last_name, email, event, description, organization, date) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.execute(osub, [first_name, last_name, email, event, description, organization, date], (error, result) => {
        if (error) {
            console.error("Database error:", error); 
            return res.status(500).send("There was an error submitting your event.");
        }

        // After successfully inserting, fetch all opportunities
        const sql = "SELECT * FROM opportunities ORDER BY date DESC";
        db.execute(sql, (error, results) => {
            if (error) {
                console.error("Error fetching opportunities:", error);
                return res.status(500).send("There was an error fetching opportunities.");
            }
            // Render the opportunities page with the updated list
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
    console.log("point 1",req.body);
    const { first_name, last_name, email, title, text, institution, date } = req.body;
    const asub = `INSERT INTO articles (first_name, last_name, email, title, text, institution, date) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`;
    console.log(req.body);
    db.execute(asub, [first_name, last_name, email, title, text, institution, date], (error, result) => {
        if (error) {
            console.error("Database error:", error); 

            return res.status(500).send("There was an error submitting your article im here.");
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


const fetchEnvironmentalData = async (latitude, longitude) => {
    const endpoints = [
        { key: 'airQuality', url: 'https://api.meersens.com/environment/public/air/current' },
        { key: 'noise', url: 'https://api.meersens.com/environment/public/noise/current' },
        { key: 'pollen', url: 'https://api.meersens.com/environment/public/pollen/current' },
        { key: 'uv', url: 'https://api.meersens.com/environment/public/uv/current' },
        { key: 'water', url: 'https://api.meersens.com/environment/public/water/current' }
    ];

    // Create promises for all API calls
    const requests = endpoints.map(async (endpoint) => {
        try {
            const response = await axios.get(endpoint.url, {
                params: {
                    lat: latitude,
                    lng: longitude,
                    health_recomendations: true
                },
                headers: {
                    'apikey': meersensKey
                }
            });
            return { [endpoint.key]: response.data }; // Return data if successful
        } catch (error) {
            console.error(`Error fetching ${endpoint.key} data:`, error.message);
            return { [endpoint.key]: null }; // Return null if error
        }
    });

    // Wait for all requests to complete
    return Promise.all(requests).then((results) => {
        return results.reduce((acc, curr) => Object.assign(acc, curr), {});
    });
};

// Your route to fetch pollution data based on ZIP code
app.get('/getPollutionData', async (req, res) => {
    const zipCode = req.query.zipCode;

    if (!zipCode) {
        return res.status(400).send('ZIP code is required.');
    }

    try {
        // Convert ZIP code to latitude and longitude using a geocoding API
        const geocodingUrl = `https://api.zippopotam.us/us/${zipCode}`;
        const geoResponse = await axios.get(geocodingUrl);

        if (geoResponse.data && geoResponse.data.places && geoResponse.data.places.length > 0) {
            const latitude = geoResponse.data.places[0].latitude;
            const longitude = geoResponse.data.places[0].longitude;
            console.log(`Coordinates for ZIP code ${zipCode}: Latitude ${latitude}, Longitude ${longitude}`);

            // Fetch all environmental data
            const environmentalData = await fetchEnvironmentalData(latitude, longitude);

            const datals = {
                zipCode,
                airQualityData: environmentalData.airQuality || 'No air quality data available for this area.',
                noiseData: environmentalData.noise || 'No noise data available for this area.',
                pollenData: environmentalData.pollen || 'No pollen data available for this area.',
                uvData: environmentalData.uv || 'No UV data available for this area.',
                waterData: environmentalData.water || 'No water quality data available for this area.'
            }

            console.log(datals)
            // Render the template and pass the data, providing fallback for unavailable data
            res.render('pollutionData', {dataList: datals});

        } else {
            res.status(500).send('Unable to get coordinates for the provided ZIP code.');
        }

    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while fetching environmental data.');
    }
});


// app.get('/getPollutionData', async (req, res) => {
    // const zipCode = req.query.zipCode;

    // if (!zipCode) {
    //     return res.status(400).send('ZIP code is required.');
    // }

    // try {
    //     const geocodingUrl = `https://api.zippopotam.us/us/${zipCode}`;
    //     const geoResponse = await axios.get(geocodingUrl);

    //     if (geoResponse.data && geoResponse.data.places && geoResponse.data.places.length > 0) {
    //         const latitude = geoResponse.data.places[0].latitude;
    //         const longitude = geoResponse.data.places[0].longitude;
    //         console.log(longitude,latitude);

    //         const endpoints = [
    //             `air-quality`,
    //             `noise`,
    //             `pollen`,
    //             `uv`,
    //             `water`,
    //             `weather`
    //         ];

    //         const fetchData = async (endpoint) => {
    //             try {
    //                 const response = await axios.get(`https://api.meersens.com/${endpoint}?lat=${latitude}&lng=${longitude}&apikey=${meersensKey}`);
    //                 return response.data;
    //             } catch (error) {
    //                 return null; // Return null if there is an error (no data available)
    //             }
    //         };

    //         // Fetch data from all endpoints
    //         const [
    //             airQualityData,
    //             noiseData,
    //             pollenData,
    //             uvData,
    //             waterData,
    //             weatherData
    //         ] = await Promise.all(endpoints.map(fetchData));

    //         // Render the template and pass the data, providing fallback for unavailable data
    //         res.render('pollutionData', {
    //             zipCode,
    //             airQualityData: airQualityData || 'No air quality data available for this area.',
    //             noiseData: noiseData || 'No noise data available for this area.',
    //             pollenData: pollenData || 'No pollen data available for this area.',
    //             uvData: uvData || 'No UV data available for this area.',
    //             waterData: waterData || 'No water quality data available for this area.',
    //             weatherData: weatherData || 'No weather data available for this area.'
    //         });

    //     } else {
    //         res.status(500).send('Unable to get coordinates for the provided ZIP code.');
    //     }

    // } catch (error) {
    //     console.error(error);
    //     res.status(500).send('An error occurred while fetching environmental data.');
    // }
// });
 
app.get("/gallery", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "gallery.html"));
});

app.listen(port, () => {
    console.log(`App server listening on ${port}. (Go to http://localhost:${port})`);
});
