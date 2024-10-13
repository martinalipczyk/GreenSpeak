const express = require("express");
const app = express();
const port = 3000;
const logger = require("morgan");
const path = require("path");
const db = require("./db/db_connection");

app.use(logger("dev"));
app.use(express.static(__dirname + "/public"));
app.set( "views",  __dirname + "/views");
app.use(express.urlencoded({ extended: true }));

app.get( "/", ( req, res ) => {
    res.sendFile( __dirname + "/views/home.html" );
} );

app.get( "/articles", ( req, res ) => {
    res.sendFile( __dirname + "/views/articles.html" );
} );

app.get( "/articlesub", ( req, res ) => {
    res.sendFile( __dirname + "/views/articlesub.html" );
} );

app.get( "/opps", ( req, res ) => {
    res.sendFile( __dirname + "/views/opps.html" );
} );

app.get( "/oppsub", ( req, res ) => {
    res.sendFile( __dirname + "/views/oppsub.html" );
} );

app.post("/submit-event", (req, res) => {
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

app.post("/submit-article", (req, res) => {
    console.log(req.body);
    const { first_name, last_name, title, text, date, email, institution } = req.body;
    const asub = `INSERT INTO articles (first_name, last_name, title, text, date, email, institution) 
VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.execute(asub, [first_name, last_name, title, text, date, email, institution], (error, result) => {
        if (error) {
            return res.status(500).send("There was an error submitting your article.");
        }
        res.send("article");
    });
});

app.listen( port, () => {
    console.log(`App server listening on ${ port }. (Go to http://localhost:${ port })` );
} );