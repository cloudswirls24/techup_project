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

app.get("/meetingdetails", (req, res) => {
  res.render("meetingdetails.ejs");
});

app.get("/calendar", (req, res) => {
  res.render("calendar.ejs");
});

app.get("/email", (req, res) => {
  res.render("email.ejs");
});

app.get("/completed", (req, res) => {
  res.render("completed.ejs");
});


//Code for meeting details page
const mtgArray = ["meetingTitle", "meetingDate","startTime", "endTime", "meetingVenue", "defaultSetting","daysAgenda","priorAgenda","daysClear","priorClear","daysSubmitMaterials","priorSubmitMaterials","daysCirculate","priorCirculate"]
mtgArray.forEach((element) => {
  var element = element;
  console.log(element);
});

function meetingDetails(req, res, next) {
  mtgArray.forEach((element) => {
    element = req.body["element"];
    console.log(element);
});
  next();
}


app.post("/submitdetails", (req, res) => {
  app.use(meetingDetails);
  res.render("calendar.ejs");
  });

// Tells the app which port to run on
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
