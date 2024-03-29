require("dotenv").config({ path: "../.env" });
const express = require("express");
const yup = require("yup");
const cors = require("cors");
const path = require("path");
const db = require("../heroes-db/dbconnect");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
app.use(cors({ credentials: true, origin: true }));
const port = 3002;
const saltRounds = 10;

app.get("/", (req, res) => {
    res.status(200).sendFile(path.join(__dirname + "/index.html"));
});

// Logging in a user, returns their id (used by Heroes Login App)
app.post("/api/user/login", (req, res) => {
    const dataFindUser = [req.body.username];
    const sqlFindUser = "SELECT password FROM user WHERE username = ?";
    db.get(sqlFindUser, dataFindUser, (err, row) => {
        if (err) {
            console.log(err.message);
            res.status(400).send(err.message);
        }
        else {
            // compare hash to passsword
            const hashedPassword = row.password;
            bcrypt.compare(req.body.password, hashedPassword).then(result => {
                if (result) {
                    console.log("User Authenticated");
                    // might change query
                    const data = [req.body.username, hashedPassword];
                    const sql = "SELECT id FROM user WHERE username = ? AND password = ?";
                    db.get(sql, data, (err, row) => {
                        if (err) {
                            console.log(err.message);
                            res.status(400).send(err.message);
                        }
                        else {
                            if (!row) res.status(400).send("User Id does not exist");
                            else {
                                // found user id
                                const accessToken = jwt.sign(row, process.env.ACCESS_TOKEN, { expiresIn: "900s" });
                                res.status(200).send({ accessToken: accessToken });
                            }
                        }
                    });
                }
                else {
                    console.log("Invalid Password");
                    res.status(400).send("Invalid Password");
                }
            }).catch(err => {
                console.log(err.message);
                res.status(400).send("Malformed Input");
            });
        }
    });
})

// register a user (used by Heroes Register App)
app.post("/api/user/register", (req, res) => {
    validate(req.body)
        .then(() => {
            // hash password
            bcrypt.hash(req.body.password, saltRounds, function (err, hashedPassword) {
                if (err) {
                    console.log(err.message);
                    res.status(404).send(err.message);
                }
                else {
                    const data = [req.body.username, hashedPassword]
                    const sql = "INSERT INTO user (username, password) VALUES (?, ?)";
                    db.run(sql, data, function (err) {
                        if (err) {
                            console.log(err.message);
                            res.status(400).send(err.message);
                        }
                        else {
                            res.status(201).send("User registered.");
                        }
                    });
                }
            });
        })
        .catch(err => {
            if (err) res.status(400).send(err.errors[0]);
        });
});

// inside heroes app or user account app (where user can change password) or delete account
// client side should make user enter password to confirm deletion
// remove based on id
// user won't be able to delete based on wrong id because id must first gotten from GET
app.delete("/api/user", (req, res) => {
    const sql = `DELETE FROM user where id = ${req.body.id}`;
    db.run(sql, function (err) {
        if (err) {
            console.log(err.message);
            res.status(400).send(err.message);
        }
        else {
            res.status(200).send("User deleted.");
        }
    })
});

// add PUT request so that user can update their password

function validate(user) {
    const schema = yup.object().shape({
        username: yup.string().min(3).max(15).required(),
        password: yup.string().required() // TODO: ADD LENGTH OF HASH LATER
    });
    return schema.validate(user);
}

app.listen(port, () => console.log(`listening on port ${port}`));
