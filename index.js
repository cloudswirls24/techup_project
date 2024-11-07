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

app.post("/submitdetails", (req, res) => {
    const meetingdata = {
    title: req.body["meetingTitle"],
    meetingDate: req.body["meetingDate"],
    startTime: req.body["startTime"],
    endTime: req.body["endTime"], 
    venue: req.body["meetingVenue"], 
    daysAgenda: req.body["daysAgenda"],
    priorAgenda: req.body["priorAgenda"],
    daysClear: req.body["daysClear"],
    priorClear: req.body["priorClear"],
    daysSubmitMaterials: req.body["daysSubmitMaterials"],
    priorSubmitMaterials: req.body["priorSubmitMaterials"],
    daysCirculate: req.body["daysCirculate"],
    priorCirculate: req.body["priorCirculate"],
  };
  res.render("calendar.ejs", {meetingdata: meetingdata});
  console.log(meetingdata)
});

// Tells the app which port to run on
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
