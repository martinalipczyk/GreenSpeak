
const db = require("./db_connection");


/**** Create some sample subjects and assignments ****/

const insert_user_sql = `
    INSERT INTO opportunities 
        (opp_id, first_name, last_name, event, description, organization, date, email) 
    VALUES 
        (?, ?, ?, ?, ?, ?, ?, ?);
`


db.execute(insert_user_sql, ['1', 'martina', 'lipczyk', 'volunteer', 'sdfjhsdkjfhkdajhkfshfksjdhfkjdsh', 'thisorgan', '']);

db.execute(insert_user_sql, ['liam', 'strauser', 'liastr26', '123', 'liastr26@bergen.org']);

db.execute(insert_user_sql, ['mia', 'subrahmanyam', 'miasub26', '456', 'miasub26@bergen.org']);

db.execute(insert_user_sql, ['yuto', 'takeda', 'yuttak26', '890', 'yuttak26@bergen.org']);

db.end();