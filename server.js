const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Подключение к БД
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// 🔹 Пинг для проверки
app.get("/ping", (req, res) => {
    res.json({ ok: true });
});

/* ================== ТОВАРЫ ================== */

// GET /products — отдать данные в формате, который ждёт фронт
app.get("/products", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM product");

        // Ожидается, что в таблице product есть поля:
        // name, price, category, subject
        const data = {};

        rows.forEach(item => {
            if (!data[item.category]) data[item.category] = {};
            if (!data[item.category][item.subject]) data[item.category][item.subject] = [];

            data[item.category][item.subject].push({
                name: item.name,
                price: item.price
            });
        });

        res.json(data);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// POST /products — добавить товар
// body: { name, price, category, subject }
app.post("/products", async (req, res) => {
    const { name, price, category, subject } = req.body;

    if (!name || !price || !category || !subject) {
        return res.status(400).json({ error: "Не хватает полей" });
    }

    try {
        const [result] = await pool.query(
            "INSERT INTO product (name, price, category, subject) VALUES (?, ?, ?, ?)",
            [name, price, category, subject]
        );

        res.json({ id: result.insertId, name, price, category, subject });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// DELETE /products/:id — удалить товар
app.delete("/products/:id", async (req, res) => {
    const { id } = req.params;

    try{
        await pool.query("DELETE FROM product WHERE id = ?", [id]);
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

/* ================== ПОЛЬЗОВАТЕЛИ ================== */

// Ожидается таблица users: id, login, password, name, surname

// POST /register — регистрация
// body: { login, password, name, surname }
app.post("/register", async (req, res) => {
    const { login, password, name, surname } = req.body;

    if (!login || !password || !name || !surname) {
        return res.status(400).json({ error: "Не хватает полей" });
    }

    try {
        const [exists] = await pool.query(
            "SELECT id FROM users WHERE login = ?",
            [login]
        );

        if (exists.length > 0) {
            return res.status(400).json({ error: "Логин уже занят" });
        }

        const [result] = await pool.query(
            "INSERT INTO users (login, password, name, surname) VALUES (?, ?, ?, ?)",
            [login, password, name, surname]
        );

        res.json({ id: result.insertId, login, name, surname });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// POST /login — вход
// body: { login, password }
app.post("/login", async (req, res) => {
    const { login, password } = req.body;

    if (!login || !password) {
        return res.status(400).json({ error: "Не хватает полей" });
    }

    try {
        const [rows] = await pool.query(
            "SELECT id, login, name, surname, password FROM users WHERE login = ?",
            [login]
        );

        if (rows.length === 0) {
            return res.status(400).json({ error: "Пользователь не найден" });
        }

        const user = rows[0];

        if (user.password !== password) {
            return res.status(400).json({ error: "Неверный пароль" });
        }

        // В реальном проекте тут нужен токен, но пока вернём просто данные
        res.json({
            id: user.id,
            login: user.login,
            name: user.name,
            surname: user.surname
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

/* ================== КОРЗИНА ================== */

// Ожидается таблица cart:
// id, user_id, product_id, quantity

// GET /cart?userId=1 — получить корзину пользователя
app.get("/cart", async (req, res) => {
    const { userId } = req.query;

    if (!userId) return res.status(400).json({ error: "Нет userId" });

    try {
        const [rows] = await pool.query(
            `SELECT c.id, c.quantity, p.id AS productId, p.name, p.price, p.category, p.subject
             FROM cart c
             JOIN product p ON c.product_id = p.id
             WHERE c.user_id = ?`,
            [userId]
        );

        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// POST /cart/add — добавить в корзину
// body: { userId, productId, quantity }
app.post("/cart/add", async (req, res) => {
    const { userId, productId, quantity } = req.body;

    if (!userId || !productId || !quantity) {
        return res.status(400).json({ error: "Не хватает полей" });
    }

    try {
        // Проверяем, есть ли уже такая запись
        const [rows] = await pool.query(
            "SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ?",
            [userId, productId]
        );

        if (rows.length > 0) {
            const newQty = rows[0].quantity + quantity;
            await pool.query(
                "UPDATE cart SET quantity = ? WHERE id = ?",
                [newQty, rows[0].id]
            );
        } else {
            await pool.query(
                "INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)",
                [userId, productId, quantity]
            );
        }

        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// POST /cart/remove — убрать из корзины
// body: { userId, productId, quantity }
app.post("/cart/remove", async (req, res) => {
    const { userId, productId, quantity } = req.body;

    if (!userId || !productId || !quantity) {
        return res.status(400).json({ error: "Не хватает полей" });
    }

    try {
        const [rows] = await pool.query(
            "SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ?",
            [userId, productId]
        );

        if (rows.length === 0) {
            return res.json({ ok: true });
        }

        const newQty = rows[0].quantity - quantity;

        if (newQty <= 0) {
            await pool.query("DELETE FROM cart WHERE id = ?", [rows[0].id]);
        } else {
            await pool.query(
                "UPDATE cart SET quantity = ? WHERE id = ?",
                [newQty, rows[0].id]
            );
        }

        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

/* ================== СТАРТ СЕРВЕРА ================== */

app.listen(process.env.PORT || 10000, () => {
    console.log("Server started");
});
