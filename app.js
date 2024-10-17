const express = require("express");
const app = express();
const port = 3000;
const logger = require("morgan");
const path = require("path");
const db = require("./db/db_connection");
const axios = require("axios");
const airNowApiKey = process.env.AIRNOW_API_KEY;


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

app.post("/submit-opp", (req, res) => {
    console.log(req.body);
    const { first_name, last_name, email, event, description, organization, date } = req.body;
    const osub = `INSERT INTO opportunities (first_name, last_name, email, event, description, organization, date) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.execute(osub, [first_name, last_name, email, event, description, organization, date], (error, result) => {
        if (error) {
            return res.status(500).send("There was an error submitting your event.");
        }
        res.send("Event submitted successfully!");
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

// app.get('/getPollutionData', (req, res) => {
//     const zipCode = req.query.zipCode;
//     if (zipCode) {
//         res.render('pollutionData', { zipCode });
//     } else {
//         res.status(400).send('ZIP code is required.');
//     }
// });
 
app.get('/getPollutionData', async (req, res) => {
    const zip = req.query.zipCode;

    try {
        // Fetch pollution data
        const airQuality = await fetch(`https://enviro.epa.gov/enviro/efservice/AIRDATA/ZIP_CODE/=/` + zip + `/json`)
            .then(res => res.json());
        const waterQuality = await fetch(`https://enviro.epa.gov/enviro/efservice/WATER_SYSTEM/ZIP_CODE/=/` + zip + `/json`)
            .then(res => res.json());
        const toxicRelease = await fetch(`https://enviro.epa.gov/enviro/efservice/TRI_FACILITY/ZIP_CODE/=/` + zip + `/json`)
            .then(res => res.json());
        const superfund = await fetch(`https://enviro.epa.gov/enviro/efservice/SEMS_ACTIVE_SITES/ZIP_CODE/=/` + zip + `/json`)
            .then(res => res.json());
        const hazardousWaste = await fetch(`https://enviro.epa.gov/enviro/efservice/RCRAINFO/ZIP_CODE/=/` + zip + `/json`)
            .then(res => res.json());
        const greenhouseGas = await fetch(`https://enviro.epa.gov/enviro/efservice/GHG_EMITTER_FACILITY/ZIP_CODE/=/` + zip + `/json`)
            .then(res => res.json());

        // Build the response data
        const data = {
            airQuality: airQuality[0] ? airQuality : "No air quality data available.",
            waterQuality: waterQuality[0] ? waterQuality : "No water quality data available.",
            toxicRelease: toxicRelease.length > 0 ? toxicRelease : "No toxic release data available.",
            superfund: superfund.length > 0 ? superfund : "No superfund site data available.",
            hazardousWaste: hazardousWaste.length > 0 ? hazardousWaste : "No hazardous waste data available.",
            greenhouseGas: greenhouseGas.length > 0 ? greenhouseGas : "No greenhouse gas emission data available."
        };

        // Render pollutionData.ejs and pass the data
        res.render("pollutionData", { data, zip });
    } catch (error) {
        console.error('Error fetching pollution data:', error);
        res.json({ error: 'Could not fetch pollution data. Please try again later.' });
    }
});


// app.get("/nearyou", (req, res) => {
//     const zipcode = req.query.zipCode;
//     const airNowUrl = `http://www.airnowapi.org/aq/observation/zipCode/current/?format=application/json&zipCode=${zipcode}&distance=25&API_KEY=${airNowApiKey}`;

//     axios.get(airNowUrl)
//         .then(response => {
//             if (response.data && response.data.length > 0) {
//                 const airData = response.data[0]; // Get the first result
//                 res.render("nearyou", { airData, zipcode, error: null });
//             } else {
//                 res.render("nearyou", { airData: null, zipcode, error: "No data available for this ZIP code." });
//             }
//         })
//         .catch(error => {
//             console.error("Error fetching air quality data:", error);
//             res.render("nearyou", { airData: null, zipcode, error: "Unable to fetch data. Please try again." });
//         });
// });


app.listen(port, () => {
    console.log(`App server listening on ${port}. (Go to http://localhost:${port})`);
});