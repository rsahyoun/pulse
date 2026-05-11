import { useMemo, useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import PatientTabs from './components/PatientTabs';
import PatientSummary from './components/PatientSummary';
import MedicationGrid from './components/MedicationGrid';
import CalendarToolbar from './components/CalendarToolbar';
import DoctorNote from './components/DoctorNote';
import CalendarGrid from './components/CalendarGrid';
import Legend from './components/Legend';
import PersonalNotes from './components/PersonalNotes';
import MedicalHistory from './components/MedicalHistory';
import Modal from './components/Modal';
import ChatWidget from './components/ChatWidget';
import AddMedicationForm from './components/AddMedicationForm';
import AddConditionForm from './components/AddConditionForm';
import UploadNoteForm from './components/UploadNoteForm';
import AddEventForm from './components/AddEventForm';
import AddPatientForm from './components/AddPatientForm';
import Tutorial from './components/Tutorial';
import LandingPage from './components/LandingPage';
import {
  currentUser,
  patients as mockPatients,
  conditions as initialConditions,
  medications as initialMedications,
  events as initialEvents,
  notes as initialNotes,
  personalNotes as initialPersonalNotes,
  eventLegend,
} from './data/mockData';
import { API_URL } from './config';
import './App.css';

function localTodayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function localToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
const TODAY_ISO = localTodayIso();

function formatRange(date, view) {
  if (view === 'day') {
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  if (view === 'month') {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  // week: Mon–Sun range
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startStr = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  if (sameMonth) {
    return `${startStr} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  const endStr = end.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startStr} – ${endStr}`;
}

export default function App() {
  const [selectedPatientId, setSelectedPatientId] = useState('margaret');
  const [view, setView] = useState('week');
  const [page, setPage] = useState('dashboard');
  const [currentDate, setCurrentDate] = useState(localToday);

  // App state — initialized from mockData, mutable via the four add forms.
  // Seed from mockData immediately so the sidebar is never blank on load.
  // Backend data overwrites this once fetched.
  const [patients, setPatients] = useState(mockPatients);
  const [medications, setMedications] = useState(initialMedications);
  const [conditions, setConditions] = useState(initialConditions);
  const [events, setEvents] = useState(initialEvents);
  const [notes, setNotes] = useState(initialNotes);
  const [personalNotes, setPersonalNotes] = useState(initialPersonalNotes);
  // AI-generated weekly summary per patient: { [patientId]: { data, loading } }
  const [aiSummaries, setAiSummaries] = useState({});
  const [history, setHistory] = useState({});
  const [showTutorial, setShowTutorial] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isExitingDashboard, setIsExitingDashboard] = useState(false);

  const handleEnter = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setShowLanding(false);
      setIsTransitioning(false);
    }, 800);
  };

  const handleStartTour = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setShowLanding(false);
      setIsTransitioning(false);
      // Wait for app entrance animation (1s) to finish before showing tutorial
      setTimeout(() => {
        setShowTutorial(true);
      }, 1000);
    }, 800);
  };

  const handleGoHome = () => {
    setIsExitingDashboard(true);
    setTimeout(() => {
      setShowLanding(true);
      setIsExitingDashboard(false);
    }, 800);
  };

  async function fetchAiSummary(patientId) {
    if (!patientId) return;
    setAiSummaries(prev => ({ ...prev, [patientId]: { data: prev[patientId]?.data, loading: true } }));
    try {
      const res = await fetch(`${API_URL}/ai/weekly-summary/${patientId}`);
      if (res.ok) {
        const data = await res.json();
        setAiSummaries(prev => ({ ...prev, [patientId]: { data, loading: false } }));
      } else {
        setAiSummaries(prev => ({ ...prev, [patientId]: { data: null, loading: false } }));
      }
    } catch {
      setAiSummaries(prev => ({ ...prev, [patientId]: { data: null, loading: false } }));
    }
  }

  const handleArchivePatient = async (patientId, currentStatus) => {
    const status = currentStatus || 'active';
    const newStatus = status === 'active' ? 'archived' : 'active';
    const action = newStatus === 'archived' ? 'Archive' : 'Restore';
    if (!window.confirm(`${action} this patient?`)) return;

    try {
      const response = await fetch(`${API_URL}/patients/${patientId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        setPatients(prev => prev.map(p => p.id === patientId ? { ...p, status: newStatus } : p));
      }
    } catch (err) {
      console.error('Failed to update patient status:', err);
    }
  };

  const handleDeletePatient = async (patientId, patientName) => {
    const message = `PERMANENTLY DELETE ALL DATA for ${patientName}?\n\nThis will wipe all medications, notes, and history FOREVER. This action cannot be undone.`;
    
    if (!window.confirm(message)) return;

    const confirmation = window.prompt(`To confirm, please type the patient's full name: "${patientName}"`);
    
    if (confirmation !== patientName) {
      if (confirmation !== null) alert("Name did not match. Deletion cancelled.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/patients/${patientId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setPatients(prev => prev.filter(p => p.id !== patientId));
        if (selectedPatientId === patientId) {
          const nextPatient = patients.find(p => p.id !== patientId);
          setSelectedPatientId(nextPatient?.id || null);
        }
      }
    } catch (err) {
      console.error('Failed to delete patient:', err);
    }
  };

  useEffect(() => {
    async function fetchData() {
      const base = API_URL;

      // Fetch patients list with retry so a slow backend start doesn't leave
      // the sidebar blank. mockPatients already seeds the UI, so this is a
      // background enrichment rather than a blocking load.
      const fetchPatients = async (attempt = 0) => {
        try {
          const res = await fetch(`${base}/patients`);
          if (res.ok) {
            const data = await res.json();
            setPatients(data);
            if (data.length > 0 && !selectedPatientId) {
              setSelectedPatientId(data[0].id);
            }
          }
        } catch {
          if (attempt < 3) {
            // Exponential backoff: 500ms, 1s, 2s
            setTimeout(() => fetchPatients(attempt + 1), 500 * 2 ** attempt);
          }
          // Silently fall back to mockPatients already in state
        }
      };
      fetchPatients();

      if (!selectedPatientId) return;

      // Fetch patient-specific data independently
      const fetches = [
        { url: `${base}/patients/${selectedPatientId}/medications`, setter: setMedications },
        { url: `${base}/patients/${selectedPatientId}/conditions`, setter: setConditions },
        { url: `${base}/patients/${selectedPatientId}/events`, setter: setEvents },
        { url: `${base}/patients/${selectedPatientId}/notes`, setter: setNotes },
        { url: `${base}/patients/${selectedPatientId}/personal-notes`, setter: setPersonalNotes },
      ];

      if (page === 'history') {
        fetches.push({ url: `${base}/patients/${selectedPatientId}/history`, setter: setHistory });
      }

      await Promise.all(
        fetches.map(async ({ url, setter }) => {
          try {
            const res = await fetch(url);
            const contentType = res.headers.get("content-type");
            if (res.ok && contentType && contentType.includes("application/json")) {
              const data = await res.json();
              setter(prev => ({ ...prev, [selectedPatientId]: data }));
            } else {
              const text = await res.text();
              console.error(`Non-JSON response from ${url} [Status ${res.status}]:`, text);
            }
          } catch (err) {
            console.error(`Failed to fetch ${url}`, err);
          }
        })
      );

      // Fetch AI weekly summary for the selected patient
      fetchAiSummary(selectedPatientId);
    }
    fetchData();
  }, [selectedPatientId, page]);

  // Which modal is open: null | 'medication' | 'condition' | 'note' | 'event'
  const [openModal, setOpenModal] = useState(null);
  // When set, the medication modal opens in edit mode for this medication.
  const [editingMedication, setEditingMedication] = useState(null);
  // When set, the event modal opens in edit mode for this event.
  const [editingEvent, setEditingEvent] = useState(null);
  // When set, the condition modal opens in edit mode for this condition.
  const [editingCondition, setEditingCondition] = useState(null);
  // When set, the patient modal opens in edit mode for this patient.
  const [editingPatient, setEditingPatient] = useState(null);
  const closeModal = () => {
    setOpenModal(null);
    setEditingMedication(null);
    setEditingEvent(null);
    setEditingCondition(null);
    setEditingPatient(null);
  };

  const patient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId),
    [selectedPatientId, patients],
  );

  const handlePrev = () => {
    const d = new Date(currentDate);
    if (view === 'day') d.setDate(d.getDate() - 1);
    else if (view === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };
  const handleNext = () => {
    const d = new Date(currentDate);
    if (view === 'day') d.setDate(d.getDate() + 1);
    else if (view === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };
  const handleToday = () => setCurrentDate(localToday());

  // Append helpers — each takes the new item and pushes onto the current patient's list.
  const addToPatient = (setter) => (item) => {
    setter((prev) => ({
      ...prev,
      [selectedPatientId]: [...(prev[selectedPatientId] || []), item],
    }));
    closeModal();
  };

  const addPatient = async (patientData) => {
    const isEdit = !!patientData.id;
    const method = isEdit ? 'PATCH' : 'POST';
    const url = isEdit
      ? `${API_URL}/patients/${patientData.id}`
      : `${API_URL}/patients/`;

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patientData),
      });
      if (response.ok) {
        const saved = await response.json();
        if (isEdit) {
          setPatients((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
        } else {
          setPatients((prev) => [...prev, saved]);
          setSelectedPatientId(saved.id);
        }
        closeModal();
      }
    } catch (error) {
      console.error('Error saving patient:', error);
    }
  };

  const addMedication = async (newMed) => {
    try {
      const response = await fetch(`${API_URL}/patients/${selectedPatientId}/medications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMed),
      });

      if (response.ok) {
        const savedMed = await response.json();
        // Update local state to reflect the new data from DB
        setMedications((prev) => ({
          ...prev,
          [selectedPatientId]: [...(prev[selectedPatientId] || []), savedMed]
        }));
        closeModal();
      }
    } catch (error) {
      console.error("Error saving medication:", error);
    }
  };
  const addCondition = async (newCondition) => {
    try {
      const response = await fetch(`${API_URL}/patients/${selectedPatientId}/conditions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCondition),
      });
      if (response.ok) {
        const savedCondition = await response.json();
        setConditions((prev) => ({
          ...prev,
          [selectedPatientId]: [...(prev[selectedPatientId] || []), savedCondition]
        }));
        closeModal();
      }
    } catch (error) {
      console.error("Error saving condition:", error);
    }
  };

  const editCondition = async (updated) => {
    const { id, ...patch } = updated;
    try {
      const response = await fetch(`${API_URL}/patients/${selectedPatientId}/conditions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (response.ok) {
        const saved = await response.json();
        setConditions((prev) => ({
          ...prev,
          [selectedPatientId]: (prev[selectedPatientId] || []).map((c) =>
            c.id === id ? saved : c,
          ),
        }));
        closeModal();
      }
    } catch (error) {
      console.error("Error updating condition:", error);
    }
  };

  const deleteCondition = async (id) => {
    try {
      const response = await fetch(`${API_URL}/patients/${selectedPatientId}/conditions/${id}`, {
        method: 'DELETE',
      });
      if (response.ok || response.status === 204) {
        setConditions((prev) => ({
          ...prev,
          [selectedPatientId]: (prev[selectedPatientId] || []).filter((c) => c.id !== id),
        }));
        closeModal();
      }
    } catch (error) {
      console.error("Error deleting condition:", error);
    }
  };

  const startEditCondition = (condition) => {
    setEditingCondition(condition);
    setOpenModal('condition');
  };
  const addEvent = async (newEvent) => {
    try {
      const response = await fetch(`${API_URL}/patients/${selectedPatientId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEvent),
      });
      if (response.ok) {
        const savedEvent = await response.json();
        setEvents((prev) => ({
          ...prev,
          [selectedPatientId]: [...(prev[selectedPatientId] || []), savedEvent],
        }));
        closeModal();
      }
    } catch (error) {
      console.error("Error saving event:", error);
    }
  };

  const editEvent = async (updatedEvent) => {
    const { id, ...patch } = updatedEvent;
    try {
      const response = await fetch(`${API_URL}/patients/${selectedPatientId}/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (response.ok) {
        const saved = await response.json();
        setEvents((prev) => ({
          ...prev,
          [selectedPatientId]: (prev[selectedPatientId] || []).map((e) =>
            e.id === id ? saved : e,
          ),
        }));
        closeModal();
      }
    } catch (error) {
      console.error("Error updating event:", error);
    }
  };

  const deleteEvent = async (id) => {
    try {
      const response = await fetch(`${API_URL}/patients/${selectedPatientId}/events/${id}`, {
        method: 'DELETE',
      });
      if (response.ok || response.status === 204) {
        setEvents((prev) => ({
          ...prev,
          [selectedPatientId]: (prev[selectedPatientId] || []).filter((e) => e.id !== id),
        }));
        closeModal();
      }
    } catch (error) {
      console.error("Error deleting event:", error);
    }
  };

  const startEditEvent = (event) => {
    setEditingEvent(event);
    setOpenModal('event');
  };

  // Adds a calendar event without closing any modal (used by DoctorNote AI actions)
  const addEventDirect = async (newEvent) => {
    try {
      const response = await fetch(`${API_URL}/patients/${selectedPatientId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEvent),
      });
      if (response.ok) {
        const savedEvent = await response.json();
        setEvents((prev) => ({
          ...prev,
          [selectedPatientId]: [...(prev[selectedPatientId] || []), savedEvent],
        }));
      }
    } catch (error) {
      console.error("Error saving event from summary:", error);
    }
  };

  const editMedication = (med) => {
    setMedications((prev) => ({
      ...prev,
      [selectedPatientId]: (prev[selectedPatientId] || []).map((m) =>
        m.id === med.id ? med : m,
      ),
    }));
    closeModal();
  };
  const deleteMedication = (id) => {
    const med = (medications[selectedPatientId] || []).find((m) => m.id === id);
    const label = med?.name ? `"${med.name}"` : 'this medication';
    if (!window.confirm(`Delete ${label}? This can't be undone.`)) return;
    setMedications((prev) => ({
      ...prev,
      [selectedPatientId]: (prev[selectedPatientId] || []).filter((m) => m.id !== id),
    }));
  };
  const startEditMedication = (med) => {
    setEditingMedication(med);
    setOpenModal('medication');
  };
  const [isUploadingNote, setIsUploadingNote] = useState(false);

  const deleteNote = async (noteId) => {
    if (!window.confirm('Delete this doctor\'s note? This cannot be undone.')) return;
    try {
      await fetch(`${API_URL}/patients/${selectedPatientId}/notes/${noteId}`, {
        method: 'DELETE',
      });
      setNotes(prev => ({
        ...prev,
        [selectedPatientId]: (prev[selectedPatientId] || []).filter(n => n.id !== noteId),
      }));
      setHistory(prev => ({
        ...prev,
        [selectedPatientId]: (prev[selectedPatientId] || []).filter(
          h => !(h._category === 'doctor_note' && (h.id === noteId || h._id === noteId)),
        ),
      }));
      // Refresh AI summary after deletion
      setTimeout(() => fetchAiSummary(selectedPatientId), 3000);
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const addNote = async ({ file, author, weekOf }) => {
    setIsUploadingNote(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('author', author);
      formData.append('week_of', weekOf);

      const response = await fetch(`${API_URL}/patients/${selectedPatientId}/notes/upload`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const savedNote = await response.json();

        // Update dashboard notes
        setNotes((prev) => ({
          ...prev,
          [selectedPatientId]: [savedNote, ...(prev[selectedPatientId] || [])],
        }));

        // Refresh the AI summary — backend generates it in the background,
        // so poll after a short delay to give ASI-1 time to finish.
        setTimeout(() => fetchAiSummary(selectedPatientId), 4000);

        // Update history timeline
        setHistory((prev) => ({
          ...prev,
          [selectedPatientId]: [
            { ...savedNote, _category: 'doctor_note', _sortDate: savedNote.weekOf },
            ...(prev[selectedPatientId] || [])
          ],
        }));

        closeModal();
        return true;
      } else {
        const err = await response.json();
        throw new Error(err.detail || 'Upload failed');
      }
    } catch (error) {
      console.error("Error uploading note:", error);
      throw error;
    } finally {
      setIsUploadingNote(false);
    }
  };

  const addPersonalNote = async (note) => {
    try {
      const response = await fetch(`${API_URL}/patients/${selectedPatientId}/personal-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note),
      });
      if (response.ok) {
        const saved = await response.json();
        setPersonalNotes((prev) => ({
          ...prev,
          [selectedPatientId]: [saved, ...(prev[selectedPatientId] || [])],
        }));
      }
    } catch (error) {
      console.error('Error saving personal note:', error);
    }
  };
  const deletePersonalNote = async (id) => {
    try {
      await fetch(`${API_URL}/patients/${selectedPatientId}/personal-notes/${id}`, {
        method: 'DELETE',
      });
      setPersonalNotes((prev) => ({
        ...prev,
        [selectedPatientId]: (prev[selectedPatientId] || []).filter((n) => n.id !== id),
      }));
    } catch (error) {
      console.error('Error deleting personal note:', error);
    }
  };
  const editPersonalNote = async (id, patch) => {
    const fields = typeof patch === 'string' ? { body: patch } : patch;
    try {
      const response = await fetch(`${API_URL}/patients/${selectedPatientId}/personal-notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (response.ok) {
        const updated = await response.json();
        setPersonalNotes((prev) => ({
          ...prev,
          [selectedPatientId]: (prev[selectedPatientId] || []).map((n) =>
            n.id === id ? updated : n,
          ),
        }));
      }
    } catch (error) {
      console.error('Error editing personal note:', error);
    }
  };
  const togglePersonalNoteDone = async (id) => {
    const note = (personalNotes[selectedPatientId] || []).find((n) => n.id === id);
    if (!note) return;
    try {
      const response = await fetch(`${API_URL}/patients/${selectedPatientId}/personal-notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !note.done }),
      });
      if (response.ok) {
        const updated = await response.json();
        setPersonalNotes((prev) => ({
          ...prev,
          [selectedPatientId]: (prev[selectedPatientId] || []).map((n) =>
            n.id === id ? updated : n,
          ),
        }));
      }
    } catch (error) {
      console.error('Error toggling personal note:', error);
    }
  };

  const layoutRef = useRef(null);
  const headerRef = useRef(null);
  const tabsRef = useRef(null);
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = Number(localStorage.getItem('layout-left-width'));
    return Number.isFinite(saved) && saved > 0 ? saved : null;
  });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (leftWidth != null) localStorage.setItem('layout-left-width', String(leftWidth));
  }, [leftWidth]);

  useEffect(() => {
    const root = document.documentElement;
    const targets = [
      [headerRef, '--header-h'],
      [tabsRef, '--tabs-h'],
    ];
    const observers = [];
    targets.forEach(([ref, varName]) => {
      const el = ref.current;
      if (!el) {
        root.style.setProperty(varName, '0px');
        return;
      }
      const update = () => root.style.setProperty(varName, `${el.offsetHeight}px`);
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      observers.push(ro);
    });
    return () => observers.forEach((ro) => ro.disconnect());
  }, [page, patient]);

  const onSplitterPointerDown = (e) => {
    if (!layoutRef.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      if (!layoutRef.current) return;
      const rect = layoutRef.current.getBoundingClientRect();
      const splitterWidth = 6;
      const minLeft = 280;
      const minRight = 360;
      const max = rect.width - minRight - splitterWidth;
      const next = Math.max(minLeft, Math.min(max, ev.clientX - rect.left));
      setLeftWidth(next);
    };
    const onUp = () => {
      setDragging(false);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onSplitterDoubleClick = () => setLeftWidth(null);

  const addMenuItems = [
    { label: 'Add condition', onSelect: () => setOpenModal('condition') },
    { label: 'Add medication', onSelect: () => setOpenModal('medication') },
    { label: "Upload doctor's note", onSelect: () => setOpenModal('note') },
    { label: 'Add event', onSelect: () => setOpenModal('event') },
  ];

  if (showLanding) {
    return (
      <LandingPage 
        onEnter={handleEnter} 
        onStartTour={handleStartTour}
        isLeaving={isTransitioning}
      />
    );
  }

  return (
    <>
      <div className={`app-entrance ${isExitingDashboard ? 'app-exit' : ''}`}>
      <div className="app">
      <div className="app-card">
        <Header
          ref={headerRef}
          user={currentUser}
          addMenuItems={addMenuItems}
          view={page}
          onViewChange={setPage}
          onStartTutorial={() => setShowTutorial(true)}
          onLogoClick={handleGoHome}
        />
        <PatientTabs
          ref={tabsRef}
          patients={patients}
          selectedId={selectedPatientId}
          onSelect={setSelectedPatientId}
          onAdd={() => {
            setEditingPatient(null);
            setOpenModal('patient');
          }}
        />
        {page === 'history' ? (
          patient ? (
            <MedicalHistory
              patient={patient}
              items={history[selectedPatientId] || []}
              onDeleteNote={deleteNote}
            />
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {patients.length === 0 ? 'No patients yet. Add one above.' : 'Loading patient...'}
            </div>
          )
        ) : (
          <div
            className="layout"
            ref={layoutRef}
            style={leftWidth != null ? { '--left-col': `${leftWidth}px` } : undefined}
          >
            {patient ? (
              <>
                <div className="layout-left">
                  <PatientSummary
                    patient={patient}
                    conditions={conditions[selectedPatientId] || []}
                    onAddCondition={() => setOpenModal('condition')}
                    onEditCondition={startEditCondition}
                    onEdit={() => {
                      setEditingPatient(patient);
                      setOpenModal('patient');
                    }}
                  />
                  <MedicationGrid
                    medications={medications[selectedPatientId] || []}
                    onAddMedication={() => setOpenModal('medication')}
                    onEditMedication={startEditMedication}
                    onDeleteMedication={deleteMedication}
                  />
                  <div className="upload-note-row">
                    <button
                      data-tour="upload-note"
                      type="button"
                      className="upload-note-btn"
                      onClick={() => setOpenModal('note')}
                    >
                      + Upload doctor's note
                    </button>
                  </div>
                  <div data-tour="doctor-notes">
                    <DoctorNote
                    notes={notes[selectedPatientId] || []}
                    summary={aiSummaries[selectedPatientId]?.data}
                    loadingSummary={aiSummaries[selectedPatientId]?.loading ?? false}
                    onDeleteNote={deleteNote}
                    onAddToCalendar={addEventDirect}
                    onAddToNotes={(text) => addPersonalNote({
                      id: `pn-${Date.now()}`,
                      body: text,
                      createdAt: new Date().toISOString(),
                      remindAt: null,
                    })}
                    events={events[selectedPatientId] || []}
                    personalNotes={personalNotes[selectedPatientId] || []}
                  />
                  </div>
                  <PersonalNotes
                    notes={personalNotes[selectedPatientId] || []}
                    onAdd={addPersonalNote}
                    onDelete={deletePersonalNote}
                    onEdit={editPersonalNote}
                    onToggleDone={togglePersonalNoteDone}
                  />
                </div>
                <div
                  className={`splitter${dragging ? ' dragging' : ''}`}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize columns. Double-click to reset."
                  onPointerDown={onSplitterPointerDown}
                  onDoubleClick={onSplitterDoubleClick}
                />
                <div className="layout-right">
                  <CalendarToolbar
                    rangeLabel={formatRange(currentDate, view)}
                    view={view}
                    onViewChange={setView}
                    onPrev={handlePrev}
                    onNext={handleNext}
                    onToday={handleToday}
                    onAddEvent={() => setOpenModal('event')}
                  />
                  <CalendarGrid
                    events={events[selectedPatientId] || []}
                    currentDate={currentDate}
                    todayISO={TODAY_ISO}
                    view={view}
                    onEventClick={startEditEvent}
                  />
                  <Legend items={eventLegend} />
                </div>
              </>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', width: '100%', color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>
                {patients.length === 0 ? 'No patients yet. Add one above.' : 'Loading patient...'}
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        open={openModal === 'patient'}
        title={editingPatient ? "Edit patient" : "Add patient"}
        onClose={closeModal}
      >
        <AddPatientForm
          key={editingPatient?.id || 'new'}
          initialData={editingPatient}
          onSubmit={addPatient}
          onArchive={() => handleArchivePatient(editingPatient?.id, editingPatient?.status)}
          onDelete={() => handleDeletePatient(editingPatient?.id, editingPatient?.fullName)}
          onCancel={closeModal}
        />
      </Modal>
      <Modal
        open={openModal === 'medication'}
        title={editingMedication ? 'Edit medication' : 'Add medication'}
        onClose={closeModal}
      >
        <AddMedicationForm
          key={editingMedication?.id || 'new'}
          initial={editingMedication}
          onSubmit={editingMedication ? editMedication : addMedication}
          onCancel={closeModal}
        />
      </Modal>
      <Modal
        open={openModal === 'condition'}
        title={editingCondition ? 'Edit condition' : 'Add active condition'}
        onClose={closeModal}
      >
        <AddConditionForm
          key={editingCondition?.id || 'new'}
          initial={editingCondition}
          onSubmit={editingCondition ? editCondition : addCondition}
          onDelete={deleteCondition}
          onCancel={closeModal}
        />
      </Modal>
      <Modal open={openModal === 'note'} title="Upload doctor's note" onClose={closeModal}>
        <UploadNoteForm currentDate={currentDate} onSubmit={addNote} onCancel={closeModal} loading={isUploadingNote} />
      </Modal>
      <Modal
        open={openModal === 'event'}
        title={editingEvent ? 'Edit event' : 'Add event'}
        onClose={closeModal}
      >
        <AddEventForm
          key={editingEvent?.id || 'new'}
          currentDate={currentDate}
          initial={editingEvent}
          onSubmit={editingEvent ? editEvent : addEvent}
          onDelete={deleteEvent}
          onCancel={closeModal}
        />
      </Modal>

    </div>
    </div>
    {!showLanding && (
      <>
        <ChatWidget
          selectedPatientId={selectedPatientId}
          patientName={patient?.fullName ?? null}
        />
        {showTutorial && <Tutorial onComplete={() => setShowTutorial(false)} />}
      </>
    )}
    </>
  );
}
