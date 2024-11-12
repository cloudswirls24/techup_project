import express from "express";
import bodyParser from "body-parser";
import { dirname } from "path";
import { fileURLToPath } from "url";
import addToCalendarButton from "add-to-calendar-button";
import { on } from "events";
import { cachedDataVersionTag } from "v8";
import { clear } from "console";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 10000;

app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({ extended: true }));

// Store meeting data globally (consider using a database in production)
let meetingData = null;

function calcMeetingMilestones(meetingDetails) {
    const meetingDate = new Date(meetingDetails.meetingDate);
    
    // Convert weeks to milliseconds
    const weekInMs = 7 * 24 * 60 * 60 * 1000;
    const dayInMs = 24 * 60 * 60 * 1000;

    // Calculate start and end dates for each milestone
    const callAgendaStart = new Date(meetingDate.getTime() - (meetingDetails.priorAgenda * weekInMs));
    const callAgendaEnd = new Date(callAgendaStart.getTime() + (meetingDetails.daysAgenda * dayInMs));
    
    const clearAgendaStart = new Date(meetingDate.getTime() - (meetingDetails.priorClear * weekInMs));
    const clearAgendaEnd = new Date(clearAgendaStart.getTime() + (meetingDetails.daysClear * dayInMs));
    
    const informItemOwnerStart = new Date(clearAgendaEnd.getTime());
    const informItemOwnerEnd = new Date(informItemOwnerStart.getTime() + dayInMs);
    
    const circulateMaterialsStart = new Date(meetingDate.getTime() - (meetingDetails.priorCirculate * weekInMs));
    const circulateMaterialsEnd = new Date(circulateMaterialsStart.getTime() + (meetingDetails.daysCirculate * dayInMs));

    return {
        callAgenda: {
            start: callAgendaStart.toLocaleDateString(),
            end: callAgendaEnd.toLocaleDateString()
        },
        clearAgenda: {
            start: clearAgendaStart.toLocaleDateString(),
            end: clearAgendaEnd.toLocaleDateString()
        },
        informItemOwner: {
            start: informItemOwnerStart.toLocaleDateString(),
            end: informItemOwnerEnd.toLocaleDateString()
        },
        circulateMaterials: {
            start: circulateMaterialsStart.toLocaleDateString(),
            end: circulateMaterialsEnd.toLocaleDateString()
        }
    };
}

//home page
app.get("/", (req, res) => {
  res.render("index.ejs");
});

//meeting details page
app.get("/meetingdetails", (req, res) => {
  res.render("meetingdetails.ejs", { timeline: null });
});


//Code for meeting details
app.post("/submitdetails", (req, res) => {
    // Store the meeting details
    meetingData = {
      meetingTitle: req.body.meetingTitle,
      meetingDate: req.body.meetingDate,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      meetingVenue: req.body.meetingVenue,
      daysAgenda: parseInt(req.body.daysAgenda),
      priorAgenda: parseInt(req.body.priorAgenda),
      daysClear: parseInt(req.body.daysClear),
      priorClear: parseInt(req.body.priorClear),
      daysSubmitMaterials: parseInt(req.body.daysSubmitMaterials),
      priorSubmitMaterials: parseInt(req.body.priorSubmitMaterials),
      daysCirculate: parseInt(req.body.daysCirculate),
      priorCirculate: parseInt(req.body.priorCirculate)
  };

  // Calculate timeline
  const timeline = calcMeetingMilestones(meetingData);
  
  // Render the page with the timeline
  res.render("meetingdetails.ejs", { timeline: timeline });
});

//calendar page
app.post("/calendar", (req, res) => {
  res.render("calendar.ejs", { meetingData });
});

// app.get("/calendar", (req, res) => {
//   res.render("calendar.ejs");
// });

//email templates page
app.get("/email", (req, res) => {
  res.render("email.ejs", { meetingData });
});

//completion page
app.get("/completed", (req, res) => {
  res.render("completed.ejs");
});




// app.post("/email", (req, res) => {
//   res.render("email.ejs");
// //   console.log(meetingTitle, meetingDate, startTime, endTime, meetingVenue, daysAgenda, priorAgenda, daysClear, priorClear, daysSubmitMaterials, priorSubmitMaterials, daysCirculate, priorCirculate)
// });



// jQuery("#flexCheckChecked").click(function () {
//     jQuery("#timeline input").toggleAttribute("disabled");
// });



// Tells the app which port to run on
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
