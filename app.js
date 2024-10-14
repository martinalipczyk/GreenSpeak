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

    console.log("point 2",req.body);
    db.execute(asub, [first_name, last_name, email, title, text, institution, date], (error, result) => {
        if (error) {
            console.error("Database error:", error); // Log the error

            return res.status(500).send("There was an error submitting your article im here.");
        }
        const getarticles = "SELECT * FROM articles ORDER BY date DESC"; 

        db.execute(getarticles, (error, results) => {
            if (error) {
                console.error("Error fetching articles:", error);
                return res.status(500).send("There was an error fetching articles.");
            }
            alert("Article submitted successfully!")
            res.render("articles", { articles: results });
    });
});
});


app.get("/nearyou", (req, res) => {
    const zipcode = req.query.zipCode;
    const airNowUrl = `http://www.airnowapi.org/aq/observation/zipCode/current/?format=application/json&zipCode=${zipcode}&distance=25&API_KEY=${airNowApiKey}`;

    axios.get(airNowUrl)
        .then(response => {
            if (response.data && response.data.length > 0) {
                const airData = response.data[0]; // Get the first result
                res.render("nearyou", { airData, zipcode, error: null });
            } else {
                res.render("nearyou", { airData: null, zipcode, error: "No data available for this ZIP code." });
            }
        })
        .catch(error => {
            console.error("Error fetching air quality data:", error);
            res.render("nearyou", { airData: null, zipcode, error: "Unable to fetch data. Please try again." });
        });
});


app.listen(port, () => {
    console.log(`App server listening on ${port}. (Go to http://localhost:${port})`);
});