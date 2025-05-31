DROP TABLE IF EXISTS Users CASCADE;
DROP TABLE IF EXISTS  Users_Database CASCADE;
DROP TABLE IF EXISTS Users_Database_tables CASCADE;

CREATE TABLE Users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
);

CREATE TABLE Users_Database (
    user_id INT NOT NULL,
    db_id INT NOT NULL,
    db_name VARCHAR(200) NOT NULL,
    PRIMARY KEY (user_id, db_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

CREATE TABLE Users_Database_tables (
    user_id INT NOT NULL,
    db_id INT NOT NULL,
    table_id INT NOT NULL,
    table_name VARCHAR(200) NOT NULL,
    PRIMARY KEY (user_id, db_id, table_id),
    FOREIGN KEY (user_id, db_id) REFERENCES Users_Database(user_id, db_id) ON DELETE CASCADE
);