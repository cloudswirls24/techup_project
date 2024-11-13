import express from "express";
import bodyParser from "body-parser";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { createMimeMessage } from 'mimetext';
import { on } from "events";
import { cachedDataVersionTag } from "v8";
import { clear } from "console";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 5000;

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

// script for emailTemplates

const EMAIL_TEMPLATES = {
  CALL_FOR_AGENDA: {
    subject: (meetingTitle) => `[Call for agenda] ${meetingData.meetingTitle}`,
    body: (data, timeline) => `
Dear all,

<b>[Call for agenda] ${meetingData.meetingTitle}</b>

This is a call for agenda for the ${meetingData.meetingTitle} scheduled for ${meetingData.meetingDate}, ${meetingData.startTime} - ${meetingData.endTime} at ${meetingData.meetingVenue}.

Please indicate your items in the following format by <u>${timeline.callAgenda.end}</u>:
<table class="table table-bordered border-black"><thead><tr><th scope="col">#</th><th scope="col">Item title</th><th scope="col">Item description</th><th scope="col">Purpose (for information /discussion /approval)</th><th scope="col">Duration (minutes)</th><th scope="col">Presenter</th></tr></thead>
<tbody><tr><td>1</td><td></td><td></td><td></td><td></td><td></td></tr></tbody></table>
Thank you.

Best regards,
    `.trim()
  },

  SEEK_CLEARANCE: {
    subject: (meetingTitle, meetingDate) => `[For clearance] Agenda for ${meetingData.meetingTitle} on ${meetingData.meetingDate}`,
    body: (data) => `
Dear <mark>[Approving Authority]</mark>,

<b>[For clearance] Agenda for ${meetingData.meetingTitle} on ${meetingData.meetingDate}</b>

This seeks your clearance for the agenda for the ${meetingData.meetingTitle} scheduled for ${meetingData.meetingDate}, ${meetingData.startTime} - ${meetingData.endTime} at ${meetingData.meetingVenue}.

<mark>[Insert agenda table here]</mark>

For your clearance,  please. Thank you.

Best regards,

    `.trim()
  },

  INFORM_ITEM_OWNERS: {
    subject: (meetingTitle, meetingDate) => `[Action required] Materials and admin arrangements for ${meetingData.meetingTitle} on ${meetingData.meetingDate}`,
    body: (data, timeline) => `
Dear all,

Your item has been included in the agenda for the ${meetingData.meetingTitle} scheduled for ${meetingData.meetingDate}, ${meetingData.startTime} - ${meetingData.endTime} at ${meetingData.meetingVenue}.

<mark>[Insert agenda table here]</mark>

Please submit your materials by ${timeline.circulateMaterials.start} to allow sufficient time for circulation.

<mark>[Insert any other admin instructions for security clearance, attendance, etc]</mark>

Thank you.

Best regards,
    `.trim()
  },

  CIRCULATE_MATERIALS: {
    subject: (meetingTitle, meetingDate) => `[For information] Materials for ${meetingData.meetingTitle} on ${meetingData.meetingDate}`,
    body: (data) => `
Dear all,

<b>[For information] Materials for ${meetingData.meetingTitle} on ${meetingData.meetingDate}</b>

Please find attached the materials for the ${meetingData.meetingTitle} scheduled for:

<b>Date: ${meetingData.meetingDate}
Time: ${meetingData.startTime} - ${meetingData.endTime}
Venue: ${meetingData.meetingVenue}</b>

<mark>[Insert agenda table here with attachments/file links]</mark>

Thank you.

Best regards,

    `.trim()
  }
};

// Function to generate MIME message

function generateMimeMessage(template, meetingData, timeline) {
  const msg = createMimeMessage();
  
  // Set basic email properties
  msg.setSender('[sender@example.com]');
  msg.setRecipient('[recipient@example.com]');
  msg.setHeader("X-Unsent", "1");
  
  // Get template content
  const templateData = EMAIL_TEMPLATES[template];
  const subject = templateData.subject(meetingData.meetingTitle, meetingData.meetingDate);
  const body = templateData.body(meetingData, timeline);
  
  // Set subject and body
  msg.setSubject(subject);
  msg.addMessage({
    contentType: 'text/html',
    data: body.replace(/\n/g, '<br>')
  });
  
  return msg;
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
        timeline: timeline,
        templates: EMAIL_TEMPLATES,
    });
});

app.get("/templates", (req, res) => {
    if (meetingData) {
        timeline = calcMeetingMilestones(meetingData);
    }
    
    res.render("templates.ejs", { 
        meetingData: meetingData,
        timeline: timeline,
        templates: EMAIL_TEMPLATES,
    });
});

// Route to generate and download MIME message
app.get("/generate-email/:template", (req, res) => {
    const template = req.params.template;
    
    if (!meetingData || !timeline || !EMAIL_TEMPLATES[template]) {
        return res.status(400).send("Invalid request");
    }
    
    const msg = generateMimeMessage(template, meetingData, timeline);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'message/rfc822');
    res.setHeader('Content-Disposition', `attachment; filename="${template.toLowerCase()}.eml"`);
    
    // Send the MIME message
    res.send(msg.asRaw());
});

// app.get("/email", (req, res) => {
//     res.render("email.ejs", { meetingData });
// });

app.get("/completed", (req, res) => {
    res.render("completed.ejs");
});

// Tells the app which port to run on
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
