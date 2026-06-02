const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Подключение к БД (та же, откуда берутся products)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// Пинг
app.get("/ping", (req, res) => {
    res.json({ ok: true });
});

/* ================== PRODUCTS ================== */

app.get("/products", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM product");

        const data = {};

        rows.forEach(item => {
            const category = item.category;
            const subject = item.subject;
            const name = item.type;
            const price = item.price;

            if (!data[category]) data[category] = {};
            if (!data[category][subject]) data[category][subject] = [];

            data[category][subject].push({
                name,
                price
            });
        });

        res.json(data);
    } catch (e) {
        console.error("Ошибка /products:", e);
        res.status(500).json({ error: e.message });
    }
});

/* ================== REGISTER ================== */

app.post("/register", async (req, res) => {
    const { surname, name, login, password, phone, address } = req.body;

    if (!surname || !name || !login || !password) {
        return res.status(400).json({ error: "Не хватает обязательных полей" });
    }

    try {
        const [exists] = await pool.query(
            "SELECT id_client FROM client WHERE login = ?",
            [login]
        );

        if (exists.length > 0) {
            return res.status(400).json({ error: "Логин уже занят" });
        }

        const [result] = await pool.query(
            "INSERT INTO client (surname, name, login, password, phone, address) VALUES (?, ?, ?, ?, ?, ?)",
            [surname, name, login, password, phone || null, address || null]
        );

        res.json({
            id_client: result.insertId,
            surname,
            name,
            login,
            phone,
            address
        });
    } catch (e) {
        console.error("Ошибка /register:", e);
        res.status(500).json({ error: e.message });
    }
});

/* ================== LOGIN ================== */

app.post("/login", async (req, res) => {
    const { login, password } = req.body;

    if (!login || !password) {
        return res.status(400).json({ error: "Не хватает полей" });
    }

    try {
        const [rows] = await pool.query(
            "SELECT * FROM client WHERE login = ?",
            [login]
        );

        if (rows.length === 0) {
            return res.status(400).json({ error: "Пользователь не найден" });
        }

        const user = rows[0];

        if (user.password !== password) {
            return res.status(400).json({ error: "Неверный пароль" });
        }

        res.json({
            id_client: user.id_client,
            surname: user.surname,
            name: user.name,
            login: user.login,
            phone: user.phone,
            address: user.address
        });
    } catch (e) {
        console.error("Ошибка /login:", e);
        res.status(500).json({ error: e.message });
    }
});

/* ================== START ================== */

app.listen(process.env.PORT || 10000, () => {
    console.log("Server started");
});
