import express from "express";
import bodyParser from "body-parser";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 10000;

app.use(express.static(__dirname + "public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.render("index.ejs");
});

// Tells the app which port to run on
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
