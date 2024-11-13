import express from "express";
import bodyParser from "body-parser";
import { dirname } from "path";
import { fileURLToPath } from "url";
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
let timeline = null;

// Default timeline settings
const defaultSettings = {
    daysAgenda: 7,
    priorAgenda: 5.5,
    daysClear: 5,
    priorClear: 4,
    daysSubmitMaterials: 3,
    priorSubmitMaterials: 1.5,
    daysCirculate: 2,
    priorCirculate: 1
};

function getTimelineSettings(formData, useDefault) {
    if (useDefault) {
        return { ...defaultSettings };
    }
    return {
        daysAgenda: parseInt(formData.daysAgenda) || defaultSettings.daysAgenda,
        priorAgenda: parseInt(formData.priorAgenda) || defaultSettings.priorAgenda,
        daysClear: parseInt(formData.daysClear) || defaultSettings.daysClear,
        priorClear: parseInt(formData.priorClear) || defaultSettings.priorClear,
        daysSubmitMaterials: parseInt(formData.daysSubmitMaterials) || defaultSettings.daysSubmitMaterials,
        priorSubmitMaterials: parseInt(formData.priorSubmitMaterials) || defaultSettings.priorSubmitMaterials,
        daysCirculate: parseInt(formData.daysCirculate) || defaultSettings.daysCirculate,
        priorCirculate: parseInt(formData.priorCirculate) || defaultSettings.priorCirculate
    };
}

function calcMeetingMilestones(meetingDetails) {
    if (!meetingDetails || !meetingDetails.meetingDate) {
        return null;
    }

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

app.get("/", (req, res) => {
    res.render("index.ejs");
});

app.get("/meetingdetails", (req, res) => {
    res.render("meetingdetails.ejs", { 
        meetingData: meetingData || { ...defaultSettings },
        timeline: timeline,
        defaultSettings: defaultSettings
    });
});

app.post("/submitdetails", (req, res) => {
  // Check if using default settings
  const useDefaultSettings = req.body.defaultSetting === 'on';
  const timelineSettings = getTimelineSettings(req.body, useDefaultSettings);

  // Create meeting data object
  meetingData = {
      meetingTitle: req.body.meetingTitle,
      meetingDate: req.body.meetingDate,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      meetingVenue: req.body.meetingVenue,
      ...timelineSettings
  };

  // Calculate timeline
  timeline = calcMeetingMilestones(meetingData);

  console.log('Meeting Data:', meetingData); // Debug log
  console.log('Timeline:', timeline); // Debug log

  // Render the page with both meetingData and timeline
  res.render("meetingdetails.ejs", { 
      meetingData: meetingData,
      timeline: timeline,
      defaultSettings: defaultSettings
  });
});

app.post("/templates", (req, res) => {
    if (meetingData) {
        timeline = calcMeetingMilestones(meetingData);
    }
    
    res.render("templates.ejs", { 
        meetingData: meetingData,
        timeline: timeline 
    });
});

app.get("/templates", (req, res) => {
    if (meetingData) {
        timeline = calcMeetingMilestones(meetingData);
    }
    
    res.render("templates.ejs", { 
        meetingData: meetingData,
        timeline: timeline 
    });
});

app.get("/email", (req, res) => {
    res.render("email.ejs", { meetingData });
});

app.get("/completed", (req, res) => {
    res.render("completed.ejs");
});

// Tells the app which port to run on
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
