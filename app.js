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

app.listen( port, () => {
    console.log(`App server listening on ${ port }. (Go to http://localhost:${ port })` );
} );