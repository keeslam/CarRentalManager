import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Translation resources
const resources = {
  en: {
    translation: {
      // Navigation
      dashboard: "Dashboard",
      vehicles: "Vehicles",
      customers: "Customers", 
      reservations: "Reservations",
      expenses: "Expenses",
      documents: "Documents",
      reports: "Reports",
      users: "Users",
      settings: "Settings",
      profile: "Profile",
      logout: "Logout",
      communications: "Communications",
      
      // Common actions
      add: "Add",
      edit: "Edit",
      delete: "Delete",
      save: "Save",
      cancel: "Cancel",
      submit: "Submit",
      search: "Search",
      filter: "Filter",
      export: "Export",
      import: "Import",
      back: "Back",
      next: "Next",
      previous: "Previous",
      close: "Close",
      view: "View",
      download: "Download",
      upload: "Upload",
      viewContract: "View Contract",
      generateContract: "Generate Contract",
      
      // Form fields
      name: "Name",
      email: "Email",
      phone: "Phone",
      address: "Address",
      city: "City",
      postalCode: "Postal Code",
      country: "Country",
      notes: "Notes",
      status: "Status",
      date: "Date",
      startDate: "Start Date",
      endDate: "End Date",
      price: "Price",
      total: "Total",
      
      // Vehicle related
      licensePlate: "License Plate",
      brand: "Brand",
      model: "Model",
      vehicleType: "Vehicle Type",
      fuel: "Fuel",
      mileage: "Mileage",
      
      // Reservation related
      reservation: "Reservation",
      customer: "Customer",
      vehicle: "Vehicle",
      duration: "Duration",
      totalPrice: "Total Price",
      
      // Contract related
      contract: "Contract",
      
      // Status messages
      success: "Success",
      error: "Error",
      warning: "Warning",
      info: "Info",
      loading: "Loading...",
      
      // Language
      language: "Language",
      english: "English",
      dutch: "Dutch",
    }
  },
  nl: {
    translation: {
      // Navigation
      dashboard: "Dashboard",
      vehicles: "Voertuigen",
      customers: "Klanten",
      reservations: "Reserveringen", 
      expenses: "Uitgaven",
      documents: "Documenten",
      reports: "Rapporten",
      users: "Gebruikers",
      settings: "Instellingen",
      profile: "Profiel",
      logout: "Uitloggen",
      communications: "Communicatie",
      
      // Common actions
      add: "Toevoegen",
      edit: "Bewerken",
      delete: "Verwijderen",
      save: "Opslaan",
      cancel: "Annuleren",
      submit: "Versturen",
      search: "Zoeken",
      filter: "Filteren",
      export: "Exporteren",
      import: "Importeren",
      back: "Terug",
      next: "Volgende",
      previous: "Vorige",
      close: "Sluiten",
      view: "Bekijken",
      download: "Downloaden",
      upload: "Uploaden",
      viewContract: "Contract Bekijken",
      generateContract: "Contract Genereren",
      
      // Form fields
      name: "Naam",
      email: "E-mail",
      phone: "Telefoon",
      address: "Adres",
      city: "Stad",
      postalCode: "Postcode",
      country: "Land",
      notes: "Notities",
      status: "Status",
      date: "Datum",
      startDate: "Startdatum",
      endDate: "Einddatum",
      price: "Prijs",
      total: "Totaal",
      
      // Vehicle related
      licensePlate: "Kenteken",
      brand: "Merk",
      model: "Model",
      vehicleType: "Voertuigtype",
      fuel: "Brandstof",
      mileage: "Kilometerstand",
      
      // Reservation related
      reservation: "Reservering",
      customer: "Klant",
      vehicle: "Voertuig",
      duration: "Duur",
      totalPrice: "Totaalprijs",
      
      // Contract related
      contract: "Contract",
      
      // Status messages
      success: "Gelukt",
      error: "Fout",
      warning: "Waarschuwing",
      info: "Informatie",
      loading: "Laden...",
      
      // Language
      language: "Taal",
      english: "Engels",
      dutch: "Nederlands",
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    
    interpolation: {
      escapeValue: false,
    },
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    }
  });

export default i18n;