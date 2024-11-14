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

const collectionId = "691";
const baseUrl = "https://api-production.data.gov.sg/v2/public/api/collections/";

async function fetchPublicHolidays() {
    try {
    // First API call to get metadata and child datasets
    const metadataResponse = await fetch(`${baseUrl}${collectionId}/metadata`);
    if (!metadataResponse.ok) {
      throw new Error('Failed to fetch metadata');
    }
    const metadata = await metadataResponse.json();

    const collectionMetadata = metadata.data.collectionMetadata;
    console.log('Collection ID:', collectionMetadata.collectionId);
    console.log('Collection Name:', collectionMetadata.name);
    console.log('Child Datasets Array:', collectionMetadata.childDatasets);

    // Extract childDatasets directly from collectionMetadata
    const childDatasets = collectionMetadata.childDatasets;
    
    if (!childDatasets || !Array.isArray(childDatasets)) {
      throw new Error('Child datasets not found or not in expected format');
    }

    // Array to store all holiday dates
    let allHolidays = [];

    // Fetch data for each child dataset
    const childDataPromises = childDatasets.map(async (datasetId) => {
      console.log('Fetching dataset:', datasetId);
      const datasetResponse = await fetch(
        `https://data.gov.sg/api/action/datastore_search?resource_id=${datasetId}`
      );
      if (!datasetResponse.ok) {
        throw new Error(`Failed to fetch dataset ${datasetId}`);
      }
      return datasetResponse.json();
    });

    // Wait for all child dataset requests to complete
    const childDataResults = await Promise.all(childDataPromises);
    
    // Process each dataset and extract holidays
    childDataResults.forEach(dataset => {
      if (dataset.success && dataset.result && dataset.result.records) {
        const holidays = dataset.result.records.map(record => ({
          date: record.date,
          holiday: record.holiday,
          day: record.day
        }));
        allHolidays = [...allHolidays, ...holidays];
      }
    });

    // Sort holidays by date
    allHolidays.sort((a, b) => new Date(a.date) - new Date(b.date));
    console.log('All public holidays:', allHolidays);
    return allHolidays;

  } catch (error) {
    console.error('Detailed error:', error);
    throw error;
  }
}
  
  // Declare SG_HOLIDAYS variable
  let SG_HOLIDAYS = [
    '2024-01-01', // New Year's Day
    '2024-02-10', // Chinese New Year Day 1
    '2024-02-11', // Chinese New Year Day 2
    '2024-03-29', // Good Friday
    '2024-04-10', // Hari Raya Puasa
    '2024-05-01', // Labour Day
    '2024-05-22', // Vesak Day
    '2024-06-17', // Hari Raya Haji
    '2024-08-09', // National Day
    '2024-11-02', // Deepavali
    '2024-12-25'  // Christmas Day
  ];
  
  // Call the function and update SG_HOLIDAYS
  fetchPublicHolidays()
    .then(holidays => {
      // Update SG_HOLIDAYS with just the dates from the API response
      SG_HOLIDAYS = holidays.map(holiday => holiday.date);
      console.log('Updated SG_HOLIDAYS:', SG_HOLIDAYS);
    })
    .catch(error => {
      console.error('Failed to fetch holidays:', error);
      // Keep the default SG_HOLIDAYS if the API call fails
    });
  

// Store meeting data globally (consider using a database in production)
let meetingData = null;
let timeline = null;
let formattedMeetingData = null;

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

  function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
  }
  
  function isHoliday(date) {
    const dateString = date.toISOString().split('T')[0];
    return SG_HOLIDAYS.includes(dateString);
  }
  
  function isWorkingDay(date) {
    return !isWeekend(date) && !isHoliday(date);
  }
  
  function addWorkingDays(startDate, days) {
    const date = new Date(startDate);
    let workingDays = days;
    
    while (workingDays > 0) {
      date.setDate(date.getDate() + 1);
      if (isWorkingDay(date)) {
        workingDays--;
      }
    }
    
    return date;
  }

  function subtractWorkingWeeks(date, weeks) {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const approximateDays = Math.ceil(weeks * 7);
    let result = new Date(date.getTime() - (approximateDays * millisecondsPerDay));
    
    // Adjust to find the nearest working day
    while (!isWorkingDay(result)) {
      result.setDate(result.getDate() - 1);
    }
    
    return result;
  }

  function formatDate(date) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const dayName = days[date.getDay()];
    
    return `${day} ${month} ${year} (${dayName})`;
  }

  function formatTime(time) {
    const [hours, minutes] = time.split(':');
    const ampm = hours >= 12 ? 'pm' : 'am';
    const formattedHours = hours % 12 || 12;
  
    return `${formattedHours}:${minutes}${ampm}`;
  }
  
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
    const today = new Date();
 
  // Calculate start and end dates for each milestone
  const callAgendaStart = subtractWorkingWeeks(new Date(meetingDate), meetingDetails.priorAgenda);
  const callAgendaEnd = addWorkingDays(new Date(callAgendaStart), meetingDetails.daysAgenda);

  const clearAgendaStart = subtractWorkingWeeks(new Date(meetingDate), meetingDetails.priorClear);
  const clearAgendaEnd = addWorkingDays(new Date(clearAgendaStart), meetingDetails.daysClear);

  const informItemOwnerStart = new Date(clearAgendaEnd);
  const informItemOwnerEnd = addWorkingDays(new Date(informItemOwnerStart), 1);

  const circulateMaterialsStart = subtractWorkingWeeks(new Date(meetingDate), meetingDetails.priorCirculate);
  const circulateMaterialsEnd = addWorkingDays(new Date(circulateMaterialsStart), meetingDetails.daysCirculate);

  const callAgendaStartPast = callAgendaStart < today;
  const callAgendaEndPast = callAgendaEnd < today;
  const clearAgendaStartPast = clearAgendaStart < today;
  const clearAgendaEndPast = clearAgendaEnd < today;
  const informItemOwnerStartPast = informItemOwnerStart < today;
  const circulateMaterialsStartPast = circulateMaterialsStart < today;
  
  return {
    callAgenda: {
      start: formatDate(callAgendaStart),
      end: formatDate(callAgendaEnd),
      isPast: callAgendaStartPast || callAgendaEndPast,
    },
    clearAgenda: {
      start: formatDate(clearAgendaStart),
      end: formatDate(clearAgendaEnd),
      isPast: clearAgendaStartPast || clearAgendaEndPast,
    },
    informItemOwner: {
      start: formatDate(informItemOwnerStart),
      end: formatDate(informItemOwnerEnd),
      isPast: informItemOwnerStartPast,
    },
    circulateMaterials: {
      start: formatDate(circulateMaterialsStart),
      end: formatDate(circulateMaterialsEnd),
      isPast: circulateMaterialsStartPast,
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

This is a call for agenda for the ${meetingData.meetingTitle} scheduled for ${formattedMeetingData.meetingDate}, ${formattedMeetingData.startTime} - ${formattedMeetingData.endTime} at ${meetingData.meetingVenue}.

Please indicate your items in the following format by <u>${timeline.callAgenda.end}</u>:
<table class="table table-bordered border-black"><thead><tr><th scope="col">#</th><th scope="col">Item title</th><th scope="col">Item description</th><th scope="col">Purpose (for information /discussion /approval)</th><th scope="col">Duration (minutes)</th><th scope="col">Presenter</th></tr></thead>
<tbody><tr><td>1</td><td></td><td></td><td></td><td></td><td></td></tr></tbody></table>
Thank you.

Best regards,
    `.trim()
  },

  SEEK_CLEARANCE: {
    subject: (meetingTitle, meetingDate) => `[For clearance] Agenda for ${meetingData.meetingTitle} on ${formattedMeetingData.meetingDate}`,
    body: (data) => `
Dear <mark>[Approving Authority]</mark>,

<b>[For clearance] Agenda for ${meetingData.meetingTitle} on ${formattedMeetingData.meetingDate}</b>

This seeks your clearance for the agenda for the ${meetingData.meetingTitle} scheduled for ${formattedMeetingData.meetingDate}, ${formattedMeetingData.startTime} - ${formattedMeetingData.endTime} at ${meetingData.meetingVenue}.

<mark>[Insert agenda table here]</mark>

For your clearance,  please. Thank you.

Best regards,

    `.trim()
  },

  INFORM_ITEM_OWNERS: {
    subject: (meetingTitle, meetingDate) => `[Action required] Materials and admin arrangements for ${meetingData.meetingTitle} on ${formattedMeetingData.meetingDate}`,
    body: (data, timeline) => `
Dear all,

Your item has been included in the agenda for the ${meetingData.meetingTitle} scheduled for ${formattedMeetingData.meetingDate}, ${formattedMeetingData.startTime} - ${formattedMeetingData.endTime} at ${meetingData.meetingVenue}.

<mark>[Insert agenda table here]</mark>

Please submit your materials by ${timeline.circulateMaterials.start} to allow sufficient time for circulation.

<mark>[Insert any other admin instructions for security clearance, attendance, etc]</mark>

Thank you.

Best regards,
    `.trim()
  },

  CIRCULATE_MATERIALS: {
    subject: (meetingTitle, meetingDate) => `[For information] Materials for ${meetingData.meetingTitle} on ${formattedMeetingData.meetingDate}`,
    body: (data) => `
Dear all,

<b>[For information] Materials for ${meetingData.meetingTitle} on ${formattedMeetingData.meetingDate}</b>

Please find attached the materials for the ${meetingData.meetingTitle} scheduled for:

<b>Date: ${formattedMeetingData.meetingDate}
Time: ${formattedMeetingData.startTime} - ${formattedMeetingData.endTime}
Venue: ${meetingData.meetingVenue}</b>

<mark>[Insert agenda table here with attachments/file links]</mark>

Thank you.

Best regards,

    `.trim()
  }
};

// Function to generate MIME message

function generateMimeMessage(template, formattedMeetingData, timeline) {
  const msg = createMimeMessage();
  
  // Set basic email properties
  msg.setSender('[sender@example.com]');
  msg.setRecipient('[recipient@example.com]');
  msg.setHeader("X-Unsent", "1");
  
  // Get template content
  const templateData = EMAIL_TEMPLATES[template];
  const subject = templateData.subject(formattedMeetingData.meetingTitle, formattedMeetingData.meetingDate);
  const body = templateData.body(formattedMeetingData, timeline);
  
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
        defaultSettings: defaultSettings,
        error:null,
        hasPastMilestones: null,
        isOnWeekendOrHoliday: null,
    });
});

app.post("/submitdetails", (req, res) => {
  // Check if using default settings
  const useDefaultSettings = req.body.defaultSetting === 'on';
  const timelineSettings = getTimelineSettings(req.body, useDefaultSettings);

  const meetingDate = new Date(req.body.meetingDate);
  const today = new Date();
  const isOnWeekendOrHoliday = !isWorkingDay(meetingDate);

  // Create meeting data object
  meetingData = {
      meetingTitle: req.body.meetingTitle,
      meetingDate: req.body.meetingDate,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      meetingVenue: req.body.meetingVenue,
      defaultSetting: useDefaultSettings,
      ...timelineSettings
  };

    // Check if any milestones are in the past
    const error = meetingDate < today;
    
  
    // Check if meeting date is in the past
      if (error || isOnWeekendOrHoliday == true) {
          return res.render("meetingdetails.ejs", {
            meetingData: meetingData,
            timeline: null,
            defaultSettings: defaultSettings,
            error: error,
            isOnWeekendOrHoliday: isOnWeekendOrHoliday,
          });
        }

  // Calculate timeline
  timeline = calcMeetingMilestones(meetingData);

  console.log('Meeting Data:', meetingData); // Debug log
  console.log('Timeline:', timeline); // Debug log
  
  const hasPastMilestones = Object.values(timeline).some((milestone) => milestone.isPast);

  formattedMeetingData = {
    meetingTitle: meetingData.meetingTitle,
    meetingDate: formatDate(new Date(meetingData.meetingDate)),
    startTime: formatTime(meetingData.startTime),
    endTime: formatTime(meetingData.endTime),
    meetingVenue: meetingData.meetingVenue,
  };
  // Render the page with both meetingData and timeline
  res.render("meetingdetails.ejs", { 
      meetingData: meetingData,
      formattedMeetingData: formattedMeetingData,
      timeline: timeline,
      defaultSettings: defaultSettings,
      error: error,
      isOnWeekendOrHoliday: isOnWeekendOrHoliday,
      hasPastMilestones: hasPastMilestones,
      });
});

app.post("/templates", (req, res) => {
    if (meetingData) {
        timeline = calcMeetingMilestones(meetingData);
       
        formattedMeetingData = {
            meetingTitle: meetingData.meetingTitle,
            meetingDate: formatDate(new Date(meetingData.meetingDate)),
            startTime: formatTime(meetingData.startTime),
            endTime: formatTime(meetingData.endTime),
            meetingVenue: meetingData.meetingVenue,
          };
     
    res.render("templates.ejs", { 
        meetingData: meetingData,
        formattedMeetingData: formattedMeetingData,
        timeline: timeline,
        templates: EMAIL_TEMPLATES,
    });
} else {
    res.render("templates.ejs", {
        meetingData: null,
        formattedMeetingData: null,
        timeline: null,
        templates: EMAIL_TEMPLATES
    });
} 
});

app.get("/templates", (req, res) => {
    if (meetingData) {
        timeline = calcMeetingMilestones(meetingData);
    }

   formattedMeetingData = {
        meetingTitle: meetingData.meetingTitle,
        meetingDate: formatDate(new Date(meetingData.meetingDate)),
        startTime: formatTime(meetingData.startTime),
        endTime: formatTime(meetingData.endTime),
        meetingVenue: meetingData.meetingVenue,
      };

    res.render("templates.ejs", { 
        meetingData: meetingData,
        formattedMeetingData: formattedMeetingData,
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
    
    const msg = generateMimeMessage(template, formattedMeetingData, timeline);
    
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
  // Clear the meetingData variable
  meetingData = null;
  timeline = null;
    res.render("completed.ejs");
});

// Tells the app which port to run on
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
