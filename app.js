// Scheduling Assistant Core Application Logic
/*
Scheduling Assistant
Copyright © 2026 Diwakar.
All rights reserved.
Unauthorized copying or redistribution is prohibited.
*/
// State management
let state = {
  reminders: [],
  activeTimeouts: {},
  recognition: null,
  isListening: false,
  chart: null,
  currentEditId: null // used if editing an existing reminder or confirming a new one
};

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  initSpeechRecognition();
  initNotificationPermission();
  loadReminders();
  initThemeClock();
  initAnalyticsChart();
  setupEventListeners();
});

// 1. Live Ticking Clock in Header
function initThemeClock() {
  const clockElement = document.getElementById('live-clock');
  const dateElement = document.getElementById('live-date');
  
  function updateClock() {
    const now = new Date();
    
    // Time format: 12:45:09 PM
    clockElement.textContent = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    
    // Date format: Tuesday, July 14, 2026
    dateElement.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }
  
  updateClock();
  setInterval(updateClock, 1000);
}

// 2. Notification Permissions
function initNotificationPermission() {
  const statusEl = document.getElementById('permission-status');
  
  if (!('Notification' in window)) {
    statusEl.innerHTML = `<span class="text-rose-400 text-xs">Notifications unsupported</span>`;
    return;
  }
  
  updatePermissionBadge(Notification.permission);
  
  // Request button trigger
  document.getElementById('btn-request-permission').addEventListener('click', () => {
    Notification.requestPermission().then(permission => {
      updatePermissionBadge(permission);
    });
  });
}

function updatePermissionBadge(permission) {
  const statusEl = document.getElementById('permission-status');
  const btn = document.getElementById('btn-request-permission');
  
  if (permission === 'granted') {
    statusEl.innerHTML = `
      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
        <span class="w-1.5 h-1.5 mr-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        Alerts Active
      </span>
    `;
    btn.classList.add('hidden');
  } else if (permission === 'denied') {
    statusEl.innerHTML = `
      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-500/20 text-rose-300 border border-rose-500/30">
        Alerts Blocked
      </span>
    `;
    btn.classList.remove('hidden');
    btn.textContent = 'Enable Alerts';
  } else {
    statusEl.innerHTML = `
      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
        Alerts Pending
      </span>
    `;
    btn.classList.remove('hidden');
    btn.textContent = 'Enable Alerts';
  }
}

// 3. Web Speech Recognition Config
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.warn('Speech Recognition not supported in this browser.');
    const micContainer = document.getElementById('mic-container');
    micContainer.innerHTML = `
      <div class="text-center p-4 border border-dashed border-rose-500/30 rounded-2xl bg-rose-950/20 text-rose-300">
        <p class="font-medium text-sm">Web Speech API Unsupported</p>
        <p class="text-xs opacity-80 mt-1">Please use Google Chrome, Microsoft Edge, or another compatible browser for voice controls.</p>
      </div>
    `;
    return;
  }
  
  state.recognition = new SpeechRecognition();
  state.recognition.continuous = false;
  state.recognition.lang = 'en-US';
  state.recognition.interimResults = true;
  state.recognition.maxAlternatives = 1;
  
  state.recognition.onstart = () => {
    state.isListening = true;
    updateMicUI(true);
    document.getElementById('transcript-text').textContent = 'Listening for commands...';
    document.getElementById('transcript-preview-box').classList.remove('hidden');
    document.getElementById('wave-visualizer').classList.remove('hidden');
  };
  
  state.recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    
    const displayTranscript = finalTranscript || interimTranscript;
    if (displayTranscript) {
      document.getElementById('transcript-text').textContent = `"${displayTranscript}"`;
    }
  };
  
  state.recognition.onerror = (event) => {
    console.error('Speech Recognition Error:', event.error);
    state.isListening = false;
    updateMicUI(false);
    document.getElementById('wave-visualizer').classList.add('hidden');
    
    let errorMsg = 'Speech recognition failed.';
    if (event.error === 'not-allowed') {
      errorMsg = 'Microphone access denied. Please verify browser permissions.';
    } else if (event.error === 'no-speech') {
      errorMsg = 'No speech detected. Please try speaking again.';
    }
    document.getElementById('transcript-text').textContent = errorMsg;
  };
  
  state.recognition.onend = () => {
    if (!state.isListening) return; // already shut down
    state.isListening = false;
    updateMicUI(false);
    document.getElementById('wave-visualizer').classList.add('hidden');
    
    const transcriptText = document.getElementById('transcript-text').textContent.replace(/"/g, '').trim();
    
    // Ignore trigger phrase guides and errors
    if (transcriptText && 
        transcriptText !== 'Listening for commands...' && 
        !transcriptText.startsWith('Microphone access') && 
        !transcriptText.startsWith('No speech')) {
      handleSpeechResult(transcriptText);
    }
  };
}

function updateMicUI(isListening) {
  const micButton = document.getElementById('btn-mic');
  const micStatusText = document.getElementById('mic-status-text');
  
  if (isListening) {
    micButton.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
    micButton.classList.add('bg-rose-600', 'pulse-recording');
    micStatusText.textContent = 'Listening... Tap to cancel';
    micStatusText.classList.add('text-rose-400');
    micStatusText.classList.remove('text-slate-400');
  } else {
    micButton.classList.remove('bg-rose-600', 'pulse-recording');
    micButton.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
    micStatusText.textContent = 'Tap microphone to speak schedule command';
    micStatusText.classList.remove('text-rose-400');
    micStatusText.classList.add('text-slate-400');
  }
}

// Toggle recording session
function toggleListening() {
  if (!state.recognition) return;
  
  if (state.isListening) {
    state.isListening = false;
    state.recognition.abort();
    updateMicUI(false);
    document.getElementById('wave-visualizer').classList.add('hidden');
    document.getElementById('transcript-preview-box').classList.add('hidden');
  } else {
    // Attempt audio context resume so sound runs
    resumeAudioContext();
    state.recognition.start();
  }
}

// 4. Custom Natural Language Date/Time Parser
function parseNaturalLanguage(text) {
  const result = {
    originalText: text,
    description: "",
    dateTime: null
  };

  let processed = text.toLowerCase().trim();

  // Common filler removal
  const fillers = [
    /^remind me to\s+/,
    /^remind me for\s+/,
    /^set a reminder to\s+/,
    /^set a reminder for\s+/,
    /^book a meeting to\s+/,
    /^book a meeting for\s+/,
    /^schedule a meeting to\s+/,
    /^schedule a meeting for\s+/,
    /^schedule a\s+/,
    /^schedule\s+/,
    /^remind me\s+/,
    /^add a reminder to\s+/,
    /^add a reminder for\s+/,
    /^add to calendar\s+/
  ];

  for (const filler of fillers) {
    processed = processed.replace(filler, "");
  }

  let dateObj = new Date();
  let timeExtracted = false;
  let dateExtracted = false;

  // Relative units: "in 2 hours", "in 15 minutes"
  const inHoursRegex = /\bin (\d+) hours?\b/i;
  const inMinutesRegex = /\bin (\d+) minutes?\b/i;
  let timeRelMatch = null;

  if ((timeRelMatch = processed.match(inHoursRegex))) {
    const hoursToAdd = parseInt(timeRelMatch[1]);
    dateObj.setHours(dateObj.getHours() + hoursToAdd);
    timeExtracted = true;
    dateExtracted = true;
    processed = processed.replace(inHoursRegex, "");
  } else if ((timeRelMatch = processed.match(inMinutesRegex))) {
    const minutesToAdd = parseInt(timeRelMatch[1]);
    dateObj.setMinutes(dateObj.getMinutes() + minutesToAdd);
    timeExtracted = true;
    dateExtracted = true;
    processed = processed.replace(inMinutesRegex, "");
  }

  // Parse Days relative
  if (!dateExtracted) {
    const todayRegex = /\b(today)\b/i;
    const tomorrowRegex = /\b(tomorrow)\b/i;
    const inDaysRegex = /\bin (\d+) days?\b/i;
    const weekdayRegex = /\b(?:on\s+)?(?:next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;
    
    let dayMatch = null;
    if (todayRegex.test(processed)) {
      dateExtracted = true;
      processed = processed.replace(todayRegex, "");
    } else if (tomorrowRegex.test(processed)) {
      dateObj.setDate(dateObj.getDate() + 1);
      dateExtracted = true;
      processed = processed.replace(tomorrowRegex, "");
    } else if ((dayMatch = processed.match(inDaysRegex))) {
      const daysToAdd = parseInt(dayMatch[1]);
      dateObj.setDate(dateObj.getDate() + daysToAdd);
      dateExtracted = true;
      processed = processed.replace(inDaysRegex, "");
    } else if ((dayMatch = processed.match(weekdayRegex))) {
      const targetDay = dayMatch[1];
      const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const targetIdx = weekdays.indexOf(targetDay.toLowerCase());
      const currentIdx = dateObj.getDay();
      let daysToAdd = targetIdx - currentIdx;
      
      // If target day is today or earlier in the week, push to next week
      if (daysToAdd <= 0) {
        daysToAdd += 7;
      }
      dateObj.setDate(dateObj.getDate() + daysToAdd);
      dateExtracted = true;
      processed = processed.replace(weekdayRegex, "");
    }
  }

  // Specific Calendar Date Parsing: "January 10th", "15 of July"
  if (!dateExtracted) {
    const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    const monthAbbrs = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const monthNamesPattern = months.concat(monthAbbrs).join("|");
    
    const specificDateRegex1 = new RegExp(`\\b(${monthNamesPattern})\\s+(\\d+)(st|nd|rd|th)?\\b`, "i");
    const specificDateRegex2 = new RegExp(`\\b(\\d+)(st|nd|rd|th)?\\s+of\\s+(${monthNamesPattern})\\b`, "i");
    
    let specificMatch = null;
    if ((specificMatch = processed.match(specificDateRegex1))) {
      const monthStr = specificMatch[1];
      const dayVal = parseInt(specificMatch[2]);
      let monthIdx = months.indexOf(monthStr.toLowerCase());
      if (monthIdx === -1) monthIdx = monthAbbrs.indexOf(monthStr.toLowerCase());
      
      dateObj.setMonth(monthIdx);
      dateObj.setDate(dayVal);
      dateExtracted = true;
      processed = processed.replace(specificDateRegex1, "");
    } else if ((specificMatch = processed.match(specificDateRegex2))) {
      const dayVal = parseInt(specificMatch[1]);
      const monthStr = specificMatch[3];
      let monthIdx = months.indexOf(monthStr.toLowerCase());
      if (monthIdx === -1) monthIdx = monthAbbrs.indexOf(monthStr.toLowerCase());
      
      dateObj.setMonth(monthIdx);
      dateObj.setDate(dayVal);
      dateExtracted = true;
      processed = processed.replace(specificDateRegex2, "");
    }
  }

  // Parse hour & minutes: "at 5 PM", "at 5:30", "17:00"
  let hour = 9; // Default 9 AM
  let minute = 0;

  const eveningRegex = /\b(evening|in the evening)\b/i;
  const morningRegex = /\b(morning|in the morning)\b/i;
  const afternoonRegex = /\b(afternoon|in the afternoon)\b/i;
  const nightRegex = /\b(night|at night)\b/i;
  const noonRegex = /\bnoon\b/i;
  const midnightRegex = /\bmidnight\b/i;

  if (!timeExtracted) {
    // Digit time matching
    const digitalTimeRegex = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
    const timeMatch = processed.match(digitalTimeRegex);
    
    if (timeMatch) {
      hour = parseInt(timeMatch[1]);
      minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const ampm = timeMatch[3];
      
      if (ampm) {
        if (ampm.toLowerCase() === 'pm' && hour < 12) hour += 12;
        if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0;
      } else {
        // Smart inference for PM if no AM/PM indicator, based on evening/afternoon cues
        if (eveningRegex.test(processed) || nightRegex.test(processed) || afternoonRegex.test(processed)) {
          if (hour < 12) hour += 12;
        } else if (hour >= 1 && hour <= 11) {
          // If no morning keyword, and hour is 1-7, default to PM (common schedules)
          if (!morningRegex.test(processed)) {
            hour += 12;
          }
        }
      }
      timeExtracted = true;
      processed = processed.replace(digitalTimeRegex, "");
    }
  }

  // If still no digit time, check textual cues
  if (!timeExtracted) {
    if (eveningRegex.test(processed)) {
      hour = 18; // 6 PM
      timeExtracted = true;
      processed = processed.replace(eveningRegex, "");
    } else if (afternoonRegex.test(processed)) {
      hour = 14; // 2 PM
      timeExtracted = true;
      processed = processed.replace(afternoonRegex, "");
    } else if (morningRegex.test(processed)) {
      hour = 9; // 9 AM
      timeExtracted = true;
      processed = processed.replace(morningRegex, "");
    } else if (nightRegex.test(processed)) {
      hour = 20; // 8 PM
      timeExtracted = true;
      processed = processed.replace(nightRegex, "");
    } else if (noonRegex.test(processed)) {
      hour = 12; // 12 PM
      timeExtracted = true;
      processed = processed.replace(noonRegex, "");
    } else if (midnightRegex.test(processed)) {
      hour = 0; // 12 AM
      timeExtracted = true;
      processed = processed.replace(midnightRegex, "");
    }
  }

  // Remove hanging preposition relics
  processed = processed.replace(/\b(on|at|for|in|to|the)\b/gi, "");
  
  // Condense spaces
  processed = processed.replace(/\s+/g, ' ').trim();

  // Set times
  dateObj.setHours(hour, minute, 0, 0);

  // Capitalize remaining text as description
  if (processed) {
    result.description = processed.charAt(0).toUpperCase() + processed.slice(1);
  } else {
    result.description = 'Voice Reminder';
  }
  
  result.dateTime = dateObj;
  return result;
}

// Handle final Speech command
function handleSpeechResult(text) {
  const parseResult = parseNaturalLanguage(text);
  
  // Format for datetime-local input (YYYY-MM-DDTHH:MM)
  const pad = (num) => String(num).padStart(2, '0');
  const d = parseResult.dateTime;
  const formattedDateTime = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  
  openEditModal(null, parseResult.description, formattedDateTime);
}

// 5. Conflict Auditor
function checkConflict(dateTimeStr, idToExclude = null) {
  const targetTime = new Date(dateTimeStr).getTime();
  
  // Check if any other reminder matches the exact minute
  return state.reminders.some(rem => {
    if (idToExclude && rem.id === idToExclude) return false;
    const remTime = new Date(rem.dateTime).getTime();
    
    // Check difference in minutes
    return Math.abs(remTime - targetTime) < 60000;
  });
}

function checkExpired(dateTimeStr) {
  const targetTime = new Date(dateTimeStr).getTime();
  const now = new Date().getTime();
  return targetTime < now;
}

// Real-time conflict status checker in Modal
function checkModalStatus() {
  const dtInput = document.getElementById('edit-datetime').value;
  const warningBox = document.getElementById('modal-warning-box');
  const warningText = document.getElementById('modal-warning-text');
  
  warningBox.classList.add('hidden');
  
  if (!dtInput) return;
  
  const isExpired = checkExpired(dtInput);
  const isConflict = checkConflict(dtInput, state.currentEditId);
  
  if (isExpired) {
    warningBox.classList.remove('hidden');
    warningBox.className = "p-3 border border-rose-500/20 rounded-xl bg-rose-950/20 text-rose-300 text-xs mt-2";
    warningText.textContent = "Caution: This date/time has already passed!";
  } else if (isConflict) {
    warningBox.classList.remove('hidden');
    warningBox.className = "p-3 border border-amber-500/20 rounded-xl bg-amber-950/20 text-amber-300 text-xs mt-2";
    warningText.textContent = "Conflict warning: You already have another reminder scheduled at this exact minute.";
  }
}

// 6. Modal controllers
function openEditModal(id = null, description = '', dateTimeStr = '') {
  state.currentEditId = id;
  
  const titleEl = document.getElementById('modal-title');
  const descInput = document.getElementById('edit-description');
  const dtInput = document.getElementById('edit-datetime');
  
  if (id) {
    titleEl.textContent = 'Edit Reminder';
  } else {
    titleEl.textContent = 'Review & Schedule';
  }
  
  descInput.value = description;
  dtInput.value = dateTimeStr;
  
  // Trigger status auditor
  checkModalStatus();
  
  // Show Modal
  document.getElementById('edit-modal').classList.remove('hidden');
  descInput.focus();
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
  state.currentEditId = null;
}

// Save reminder from Modal submission
function saveReminderFromModal(e) {
  e.preventDefault();
  
  const description = document.getElementById('edit-description').value.trim();
  const dateTimeStr = document.getElementById('edit-datetime').value;
  
  if (!description) {
    alert('Please enter a description.');
    return;
  }
  if (!dateTimeStr) {
    alert('Please pick a date and time.');
    return;
  }
  
  if (state.currentEditId) {
    // Edit action
    const index = state.reminders.findIndex(rem => rem.id === state.currentEditId);
    if (index !== -1) {
      state.reminders[index].description = description;
      state.reminders[index].dateTime = dateTimeStr;
    }
  } else {
    // Create action
    const newReminder = {
      id: 'rem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      description: description,
      dateTime: dateTimeStr,
      createdTime: new Date().toISOString(),
      notified: false
    };
    state.reminders.push(newReminder);
  }
  
  saveReminders();
  renderRemindersList();
  closeEditModal();
}

// 7. Scheduler Timers & Chimes
function scheduleAllTimers() {
  // Clear any existing active timeouts
  Object.keys(state.activeTimeouts).forEach(id => {
    clearTimeout(state.activeTimeouts[id]);
  });
  state.activeTimeouts = {};
  
  const now = Date.now();
  
  state.reminders.forEach(reminder => {
    const reminderTime = new Date(reminder.dateTime).getTime();
    
    // Only schedule if in future and not already notified
    if (reminderTime > now && !reminder.notified) {
      const delay = reminderTime - now;
      
      const timeoutId = setTimeout(() => {
        fireReminder(reminder);
      }, delay);
      
      state.activeTimeouts[reminder.id] = timeoutId;
    }
  });
}

// Alarm Fire event
function fireReminder(reminder) {
  // Update state notified parameter
  const index = state.reminders.findIndex(rem => rem.id === reminder.id);
  if (index !== -1) {
    state.reminders[index].notified = true;
    saveReminders();
    renderRemindersList();
  }
  
  // Play Synth Audio
  playNotificationSound();
  
  // Push System Notification
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Reminder Alert!', {
      body: reminder.description,
      tag: reminder.id,
      requireInteraction: true
    });
  }
  
  // Display In-App Alarm modal Overlay
  openAlarmOverlay(reminder);
}

// Synth double chime chime audio
let audioCtx = null;
function resumeAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playNotificationSound() {
  try {
    resumeAudioContext();
    const now = audioCtx.currentTime;
    
    // First node: E5 (659.25 Hz)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.25, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);
    
    // Second node: A5 (880.00 Hz)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now + 0.15);
    gain2.gain.setValueAtTime(0, now + 0.15);
    gain2.gain.linearRampToValueAtTime(0.25, now + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.75);
  } catch (e) {
    console.error('Failed synthesizing audio chime:', e);
  }
}

// Alarm Fired Full Screen Overlay controls
function openAlarmOverlay(reminder) {
  const overlay = document.getElementById('alarm-overlay');
  const desc = document.getElementById('alarm-desc');
  const time = document.getElementById('alarm-time');
  
  desc.textContent = reminder.description;
  
  const d = new Date(reminder.dateTime);
  time.textContent = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + 
                     ' - ' + 
                     d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                     
  overlay.classList.remove('hidden');
}

// Custom Close and Snooze
function closeAlarmOverlay() {
  document.getElementById('alarm-overlay').classList.add('hidden');
}

function snoozeAlarm() {
  // Clear alarm overlay, reschedule reminder for +5 minutes
  closeAlarmOverlay();
  
  const currentDesc = document.getElementById('alarm-desc').textContent;
  const d = new Date();
  d.setMinutes(d.getMinutes() + 5);
  
  // Format for local datetime
  const pad = (num) => String(num).padStart(2, '0');
  const formattedDateTime = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  
  const snoozedReminder = {
    id: 'rem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    description: `Snoozed: ${currentDesc}`,
    dateTime: formattedDateTime,
    createdTime: new Date().toISOString(),
    notified: false
  };
  
  state.reminders.push(snoozedReminder);
  saveReminders();
  renderRemindersList();
}

// 8. CRUD state controls
function loadReminders() {
  const saved = localStorage.getItem('voice_reminders');
  if (saved) {
    try {
      state.reminders = JSON.parse(saved);
    } catch (e) {
      console.error('Failed loading saved reminders:', e);
      state.reminders = [];
    }
  } else {
    // Add sample placeholder reminder to show functionality
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0); // next hour
    const pad = (num) => String(num).padStart(2, '0');
    const defaultTimeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    
    state.reminders = [
      {
        id: 'sample_1',
        description: 'Sample Reminder: Walk the dog',
        dateTime: defaultTimeStr,
        createdTime: new Date().toISOString(),
        notified: false
      }
    ];
    saveReminders();
  }
  
  renderRemindersList();
  scheduleAllTimers();
}

function saveReminders() {
  localStorage.setItem('voice_reminders', JSON.stringify(state.reminders));
  scheduleAllTimers();
  updateAnalyticsChart();
}

function deleteReminder(id) {
  // Clear timer if active
  if (state.activeTimeouts[id]) {
    clearTimeout(state.activeTimeouts[id]);
    delete state.activeTimeouts[id];
  }
  
  state.reminders = state.reminders.filter(rem => rem.id !== id);
  saveReminders();
  renderRemindersList();
}

// Export to ICS File standard
function exportToICS(reminder) {
  const pad = (num) => String(num).padStart(2, '0');
  
  const formatICSDate = (dateObj) => {
    return `${dateObj.getUTCFullYear()}${pad(dateObj.getUTCMonth() + 1)}${pad(dateObj.getUTCDate())}T${pad(dateObj.getUTCHours())}${pad(dateObj.getUTCMinutes())}00Z`;
  };
  
  const eventDate = new Date(reminder.dateTime);
  const startDateStr = formatICSDate(eventDate);
  
  // Set duration to 30 mins by default
  const endDate = new Date(eventDate.getTime() + 30 * 60 * 1000);
  const endDateStr = formatICSDate(endDate);
  
  const now = new Date();
  const createdDateStr = formatICSDate(now);
  
  // Cleanup description from escaping characters
  const escapedDesc = reminder.description.replace(/[,;]/g, '\\$&').replace(/\n/g, '\\n');
  
  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Scheduling Assistant//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${reminder.id}@scheduling.assistant`,
    `DTSTAMP:${createdDateStr}`,
    `DTSTART:${startDateStr}`,
    `DTEND:${endDateStr}`,
    `SUMMARY:${escapedDesc}`,
    'DESCRIPTION:Scheduled via Scheduling Assistant',
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  
  const icsString = icsLines.join('\r\n');
  const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  // Trigger file downloading
  const link = document.createElement('a');
  link.href = url;
  link.download = `${reminder.description.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_reminder.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 8. Render Reminders Checklists
function renderRemindersList() {
  const upcomingListEl = document.getElementById('upcoming-list');
  const pastListEl = document.getElementById('past-list');
  
  upcomingListEl.innerHTML = '';
  pastListEl.innerHTML = '';
  
  const now = Date.now();
  
  // Sort reminders chronologically
  const sorted = [...state.reminders].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  
  let upcomingCount = 0;
  let pastCount = 0;
  
  sorted.forEach(rem => {
    const isPast = new Date(rem.dateTime).getTime() < now;
    const itemEl = document.createElement('div');
    
    // Formatting date and time
    const d = new Date(rem.dateTime);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    itemEl.className = "flex items-center justify-between p-3.5 border rounded-xl transition-all duration-200 " + 
                       (isPast 
                         ? "border-slate-800 bg-slate-900/30 opacity-60" 
                         : "border-slate-700/60 bg-slate-800/40 hover:border-slate-600/80");
    
    // Highlight if conflict exists on active cards
    let conflictBadge = '';
    if (!isPast && checkConflict(rem.dateTime, rem.id)) {
      conflictBadge = `
        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 ml-2" title="Conflicts with another reminder slot.">
          Double Booked
        </span>
      `;
    }
    
    itemEl.innerHTML = `
      <div class="flex-1 min-w-0 pr-3">
        <div class="flex items-center flex-wrap gap-y-1">
          <h4 class="text-sm font-semibold text-slate-100 truncate">${rem.description}</h4>
          ${conflictBadge}
        </div>
        <div class="flex items-center text-xs text-slate-400 mt-1 space-x-3">
          <span class="flex items-center">
            <i data-lucide="calendar" class="w-3.5 h-3.5 mr-1 text-indigo-400"></i>
            ${dateStr}
          </span>
          <span class="flex items-center">
            <i data-lucide="clock" class="w-3.5 h-3.5 mr-1 text-indigo-400"></i>
            ${timeStr}
          </span>
        </div>
      </div>
      <div class="flex items-center space-x-1.5">
        <button onclick="exportToICSById('${rem.id}')" 
                class="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-700/30 rounded-lg transition-colors duration-150" 
                title="Export Calendar File (.ics)">
          <i data-lucide="download" class="w-4 h-4"></i>
        </button>
        <button onclick="editReminderById('${rem.id}')" 
                class="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-700/30 rounded-lg transition-colors duration-150" 
                title="Edit Reminder">
          <i data-lucide="edit" class="w-4 h-4"></i>
        </button>
        <button onclick="deleteReminder('${rem.id}')" 
                class="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700/30 rounded-lg transition-colors duration-150" 
                title="Remove Reminder">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    `;
    
    if (isPast) {
      pastListEl.appendChild(itemEl);
      pastCount++;
    } else {
      upcomingListEl.appendChild(itemEl);
      upcomingCount++;
    }
  });
  
  // Empty states
  if (upcomingCount === 0) {
    upcomingListEl.innerHTML = `
      <div class="text-center py-8 text-slate-500 text-sm">
        <i data-lucide="calendar-check" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
        No upcoming reminders scheduled.
      </div>
    `;
  }
  if (pastCount === 0) {
    pastListEl.innerHTML = `
      <div class="text-center py-6 text-slate-500 text-sm">
        No past reminders logged.
      </div>
    `;
  }
  
  // Refresh Lucide SVGs
  if (window.lucide) {
    lucide.createIcons();
  }
}

// Global button triggers mapped inside app
window.exportToICSById = (id) => {
  const reminder = state.reminders.find(rem => rem.id === id);
  if (reminder) exportToICS(reminder);
};

window.editReminderById = (id) => {
  const reminder = state.reminders.find(rem => rem.id === id);
  if (reminder) {
    openEditModal(reminder.id, reminder.description, reminder.dateTime);
  }
};

window.deleteReminder = deleteReminder;
window.handleSpeechResult = handleSpeechResult;

// 9. Chart.js booking activity chart (30 days logs)
function initAnalyticsChart() {
  const ctx = document.getElementById('analyticsChart').getContext('2d');
  
  // Generate labels for last 30 days
  const dataMap = get30DaysData();
  
  state.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dataMap.labels,
      datasets: [{
        label: 'Booked Tasks',
        data: dataMap.data,
        backgroundColor: 'rgba(99, 102, 241, 0.45)',
        borderColor: 'rgba(99, 102, 241, 0.85)',
        borderWidth: 1.5,
        borderRadius: 4,
        hoverBackgroundColor: 'rgba(168, 85, 247, 0.6)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          titleFont: { family: 'Outfit', size: 12 },
          bodyFont: { family: 'Outfit', size: 12 },
          padding: 8,
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#94a3b8',
            font: {
              family: 'Outfit',
              size: 10
            },
            maxRotation: 45,
            minRotation: 45
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.03)'
          },
          ticks: {
            color: '#94a3b8',
            font: {
              family: 'Outfit',
              size: 10
            },
            stepSize: 1,
            precision: 0
          },
          min: 0
        }
      }
    }
  });
}

function updateAnalyticsChart() {
  if (!state.chart) return;
  const dataMap = get30DaysData();
  state.chart.data.labels = dataMap.labels;
  state.chart.data.datasets[0].data = dataMap.data;
  state.chart.update();
}

// Aggregate reminder items by booking (createdTime) date for the last 30 days
function get30DaysData() {
  const labels = [];
  const data = [];
  const dateCounts = {};
  
  // Initialize date counts dictionary for past 30 days
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    labels.push(dateStr);
    dateCounts[dateStr] = 0;
  }
  
  // Count bookmarks matching label names
  state.reminders.forEach(rem => {
    // Determine the booking registration date. We use createdTime.
    const createdDate = new Date(rem.createdTime || rem.dateTime);
    const dateStr = createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (dateStr in dateCounts) {
      dateCounts[dateStr]++;
    }
  });
  
  // Populate array datasets
  labels.forEach(lbl => {
    data.push(dateCounts[lbl]);
  });
  
  return { labels, data };
}

// 10. General Events Setup
function setupEventListeners() {
  // Mic trigger
  document.getElementById('btn-mic').addEventListener('click', toggleListening);
  
  // Create Manual Trigger
  document.getElementById('btn-add-manual').addEventListener('click', () => {
    // Current local time format for picker
    const now = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const defaultTimeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    
    openEditModal(null, '', defaultTimeStr);
  });
  
  // Modal buttons
  document.getElementById('btn-close-modal').addEventListener('click', closeEditModal);
  document.getElementById('btn-cancel-modal').addEventListener('click', closeEditModal);
  document.getElementById('edit-form').addEventListener('submit', saveReminderFromModal);
  
  // Real-time conflict/expire triggers in modal
  document.getElementById('edit-datetime').addEventListener('input', checkModalStatus);
  
  // Alarm modal actions
  document.getElementById('btn-dismiss-alarm').addEventListener('click', closeAlarmOverlay);
  document.getElementById('btn-snooze-alarm').addEventListener('click', snoozeAlarm);
  
  // Keyboard Escape key listeners
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEditModal();
      closeAlarmOverlay();
    }
  });
}
