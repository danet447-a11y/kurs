const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Подключение к БД (Beget)
const pool = mysql.createPool({
    host: process.env.DB_HOST,     // alyonyvd.beget.tech
    user: process.env.DB_USER,     // alyonyvd_alyonyn
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, // alyonyvd_alyonyn
});

// 🔹 Пинг для проверки
app.get("/ping", (req, res) => {
    res.json({ ok: true });
});

/* ================== ТОВАРЫ ================== */
// Таблица: product
// id_product, category, subject, type, price

// GET /products — отдать данные в формате, который ждёт фронт
app.get("/products", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM product");

        const data = {};

        rows.forEach(item => {
            const category = item.category;
            const subject = item.subject;
            const name = item.type; // поле type = название работы
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

// POST /products — добавить товар
// body: { category, subject, type, price }
app.post("/products", async (req, res) => {
    const { category, subject, type, price } = req.body;

    if (!category || !subject || !type || !price) {
        return res.status(400).json({ error: "Не хватает полей" });
    }

    try {
        const [result] = await pool.query(
            "INSERT INTO product (category, subject, type, price) VALUES (?, ?, ?, ?)",
            [category, subject, type, price]
        );

        res.json({
            id_product: result.insertId,
            category,
            subject,
            type,
            price
        });
    } catch (e) {
        console.error("Ошибка POST /products:", e);
        res.status(500).json({ error: e.message });
    }
});

// DELETE /products/:id — удалить товар
app.delete("/products/:id", async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query("DELETE FROM product WHERE id_product = ?", [id]);
        res.json({ ok: true });
    } catch (e) {
        console.error("Ошибка DELETE /products:", e);
        res.status(500).json({ error: e.message });
    }
});

/* ================== КЛИЕНТЫ ================== */
// Таблица: client
// id_client, surname, name, login, password, phone, address

// POST /register — регистрация
// body: { surname, name, login, password, phone, address }
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

// POST /login — вход
// body: { login, password }
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

/* ================== КОРЗИНА ================== */
// Таблица: cart
// id_client, id_product, amount

// GET /cart?clientId=1 — получить корзину клиента
app.get("/cart", async (req, res) => {
    const { clientId } = req.query;

    if (!clientId) {
        return res.status(400).json({ error: "Нет clientId" });
    }

    try {
        const [rows] = await pool.query(
            `SELECT 
                c.id_client,
                c.id_product,
                c.amount,
                p.category,
                p.subject,
                p.type,
                p.price
             FROM cart c
             JOIN product p ON c.id_product = p.id_product
             WHERE c.id_client = ?`,
            [clientId]
        );

        res.json(rows);
    } catch (e) {
        console.error("Ошибка GET /cart:", e);
        res.status(500).json({ error: e.message });
    }
});

// POST /cart/add — добавить в корзину
// body: { clientId, productId, amount }
app.post("/cart/add", async (req, res) => {
    const { clientId, productId, amount } = req.body;

    if (!clientId || !productId || !amount) {
        return res.status(400).json({ error: "Не хватает полей" });
    }

    try {
        const [rows] = await pool.query(
            "SELECT amount FROM cart WHERE id_client = ? AND id_product = ?",
            [clientId, productId]
        );

        if (rows.length > 0) {
            const newAmount = rows[0].amount + amount;
            await pool.query(
                "UPDATE cart SET amount = ? WHERE id_client = ? AND id_product = ?",
                [newAmount, clientId, productId]
            );
        } else {
            await pool.query(
                "INSERT INTO cart (id_client, id_product, amount) VALUES (?, ?, ?)",
                [clientId, productId, amount]
            );
        }

        res.json({ ok: true });
    } catch (e) {
        console.error("Ошибка POST /cart/add:", e);
        res.status(500).json({ error: e.message });
    }
});

// POST /cart/remove — убрать из корзины
// body: { clientId, productId, amount }
app.post("/cart/remove", async (req, res) => {
    const { clientId, productId, amount } = req.body;

    if (!clientId || !productId || !amount) {
        return res.status(400).json({ error: "Не хватает полей" });
    }

    try {
        const [rows] = await pool.query(
            "SELECT amount FROM cart WHERE id_client = ? AND id_product = ?",
            [clientId, productId]
        );

        if (rows.length === 0) {
            return res.json({ ok: true });
        }

        const newAmount = rows[0].amount - amount;

        if (newAmount <= 0) {
            await pool.query(
                "DELETE FROM cart WHERE id_client = ? AND id_product = ?",
                [clientId, productId]
            );
        } else {
            await pool.query(
                "UPDATE cart SET amount = ? WHERE id_client = ? AND id_product = ?",
                [newAmount, clientId, productId]
            );
        }

        res.json({ ok: true });
    } catch (e) {
        console.error("Ошибка POST /cart/remove:", e);
        res.status(500).json({ error: e.message });
    }
});

/* ================== СТАРТ СЕРВЕРА ================== */

app.listen(process.env.PORT || 10000, () => {
    console.log("Server started");
});
