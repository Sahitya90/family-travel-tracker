import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "world",
  password: "Sahitya90@#",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

let currentUserId = 1;

//function to get hold of the countries that the current user has visited
async function getVisitedCountry(userId) {

  const result = await db.query(
    "SELECT country_code FROM visited_country WHERE user_id = $1", [userId]
  );
  return result.rows.map((row)=> row.country_code);
}

//for home page

app.get("/", async (req, res) => {
  
  try{
    //get hold of all the users from the users table
    const usersResult = await db.query("SELECT * FROM users ORDER BY id ASC");
    const users = usersResult.rows;
    //get hold of the country codes for the current user
    const visitedCodes = await getVisitedCountry(currentUserId);

  // render ejs file, by filling the respective data, that will be sent to the ejs file
    res.render("index.ejs", {
      countries: visitedCodes,
      users: users,
      currentUserId: currentUserId,
    });
  }catch(error){
    console.error("Error loading home page : ");
    res.status(500).send("Database error");
  }
});

//to switch between active user
app.post("/user", async(req, res)=>{

  const{ userId } = req.body;
  currentUserId = parseInt(userId);

  try{
    const visitedCodes = await getVisitedCountry(currentUserId);
    res.json({ success: true, countries: visitedCodes, userId: currentUserId });
  }catch(err){
    console.error("Error switching between user:", err);
    res.status(500).json({ success: false, error: "Failed to fetch user data"});
  }
});


//to add a new country for a particular user in the database
app.post("/add", async (req, res) => {

  const {countryCode, userId } = req.body;

  try{

    const countryResult = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name)  = LOWER($1) OR LOWER(country_code) = LOWER($1); ",
       [countryCode]
    );
    if(countryResult.rows.length == 0){
      return res.status(404).json({ error: "Country not found"});
    }
    const code = countryResult.rows[0].country_code;

    await db.query(
      "INSERT INTO visited_country (country_code, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [code, userId]
    );

    const VisitedCodes = await getVisitedCountry(userId);
    res.json({ visitedCountries: VisitedCodes});

  }catch(err){
    console.error(err);
    res.status(500).json({error : "Database operation failed"});
  }
});

//to create a new user 
app.post("/new", async (req, res) => {

const { username, colorChoice } = req.body;
  try{

    const existingUser = await db.query(" SELECT * FROM users WHERE LOWER(user_name) = LOWER($1);", [username]);
    
    if(existingUser.rows.length > 0){
      return res.status(400).json({error : " This user already exists"});
    }

    const newUser = await db.query("INSERT INTO users (user_name, color_choice) VALUES ($1, $2) RETURNING id, user_name, color_choice;", [username, colorChoice]);

    const user = newUser.rows[0];
    currentUserId = user.id;

    res.json({
      user : {
        id: user.id,
        name: user.user_name,
        color: user.color_choice,
        visitedCountries: []
      }
    });
  }catch(err){
    console.error(err);
    res.status(500).json({ error : " Failed to Register User"});
  }                                                                                                                                                                                                                                                                                                                                                                                   
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
