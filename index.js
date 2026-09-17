import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const app = express();
// Use the hosting provider's dynamic port or default to 3000 locally
const port = process.env.PORT || 3000;

// Configured for single connection URL (DATABASE_URL) with SSL support for Neon
const db = new pg.Client({
  connectionString: process.env.DATABASE_URL || `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME}`,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

db.connect()
  .then(() => console.log("Connected to PostgreSQL successfully"))
  .catch((err) => console.error("Database connection error:", err));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

let currentUserId = 1;

// Function to get hold of the countries that the current user has visited
async function getVisitedCountry(userId) {
  const result = await db.query(
    "SELECT country_code FROM visited_country WHERE user_id = $1", [userId]
  );
  return result.rows.map((row) => row.country_code);
}

// Home page
app.get("/", async (req, res) => {
  try {
    const usersResult = await db.query("SELECT * FROM users ORDER BY id ASC");
    const users = usersResult.rows;
    const visitedCodes = await getVisitedCountry(currentUserId);

    res.render("index.ejs", {
      countries: visitedCodes,
      users: users,
      currentUserId: currentUserId,
    });
  } catch (error) {
    console.error("Error loading home page:", error);
    res.status(500).send("Database error");
  }
});

// Switch active user
app.post("/user", async (req, res) => {
  const { userId } = req.body;
  currentUserId = parseInt(userId);

  try {
    const visitedCodes = await getVisitedCountry(currentUserId);
    res.json({ success: true, countries: visitedCodes, userId: currentUserId });
  } catch (err) {
    console.error("Error switching between user:", err);
    res.status(500).json({ success: false, error: "Failed to fetch user data" });
  }
});

// Add a visited country
app.post("/add", async (req, res) => {
  const { countryCode, userId } = req.body;

  try {
    const countryResult = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) = LOWER($1) OR LOWER(country_code) = LOWER($1);",
      [countryCode]
    );

    if (countryResult.rows.length === 0) {
      return res.status(404).json({ error: "Country not found" });
    }
    const code = countryResult.rows[0].country_code;

    await db.query(
      "INSERT INTO visited_country (country_code, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [code, userId]
    );

    const visitedCodes = await getVisitedCountry(userId);
    res.json({ visitedCountries: visitedCodes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database operation failed" });
  }
});

// Create a new user
app.post("/new", async (req, res) => {
  const { username, colorChoice } = req.body;

  try {
    const existingUser = await db.query(
      "SELECT * FROM users WHERE LOWER(user_name) = LOWER($1);",
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "This user already exists" });
    }

    const newUser = await db.query(
      "INSERT INTO users (user_name, color_choice) VALUES ($1, $2) RETURNING id, user_name, color_choice;",
      [username, colorChoice]
    );

    const user = newUser.rows[0];
    currentUserId = user.id;

    res.json({
      user: {
        id: user.id,
        name: user.user_name,
        color: user.color_choice,
        visitedCountries: []
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to Register User" });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});