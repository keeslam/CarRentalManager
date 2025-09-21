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
      
      // Auth page
      vehicleFleetManager: "Vehicle Fleet Manager",
      signInToContinue: "Sign in to continue to your dashboard",
      login: "Login",
      register: "Register",
      enterCredentials: "Enter your credentials to access your account",
      username: "Username",
      yourUsername: "Your username",
      password: "Password",
      yourPassword: "Your password",
      confirmPassword: "Confirm Password",
      confirmYourPassword: "Confirm your password",
      signingIn: "Signing in...",
      registering: "Registering...",
      alreadyHaveAccount: "Already have an account? Login here",
      
      // Validation messages
      usernameRequired: "Username is required",
      passwordRequired: "Password is required",
      usernameMinLength: "Username must be at least 3 characters",
      passwordMinLength: "Password must be at least 6 characters",
      pleaseConfirmPassword: "Please confirm your password",
      passwordsDontMatch: "Passwords don't match",
      invalidEmail: "Invalid email address when provided",
      nameMinLength: "Name must be at least 2 characters",
      
      // Fleet management info
      fleetManagementSystem: "Fleet Management System",
      streamlineOperations: "Streamline your vehicle rental operations with our comprehensive management system",
      trackVehicles: "Track vehicles, customers, and reservations",
      generateContracts: "Generate contracts and manage documents",
      monitorExpenses: "Monitor expenses and maintenance alerts",
      comprehensiveReporting: "Comprehensive reporting and analytics",
      
      // Form labels and fields (common)
      firstName: "First Name",
      lastName: "Last Name",
      companyName: "Company Name",
      contactPerson: "Contact Person",
      driverName: "Driver Name",
      streetName: "Street Name",
      debtorNumber: "Debtor Number",
      chamberOfCommerce: "Chamber of Commerce Number",
      vatNumber: "VAT Number",
      description: "Description",
      amount: "Amount",
      category: "Category",
      required: "Required",
      optional: "Optional",
      
      // Dashboard and widgets
      quickActions: "Quick Actions",
      availableVehicles: "Available Vehicles",
      totalVehicles: "Total Vehicles",
      activeReservations: "Active Reservations",
      totalCustomers: "Total Customers",
      upcomingReservations: "Upcoming Reservations",
      recentExpenses: "Recent Expenses",
      vehicleAvailability: "Vehicle Availability",
      apkExpirations: "APK Expirations",
      warrantyExpirations: "Warranty Expirations",
      noDataAvailable: "No data available",
      viewAll: "View All",
      
      // Actions and buttons
      addNew: "Add New",
      editItem: "Edit",
      deleteItem: "Delete",
      saveChanges: "Save Changes",
      discardChanges: "Discard Changes",
      confirmAction: "Confirm",
      cancelAction: "Cancel",
      
      // Filters and placeholders
      allTypes: "All Types",
      allBrands: "All Brands",
      noAvailableVehicles: "No available vehicles",
      noDataFound: "No data found",
      period: "Period",
      administration: "Administration",
      backupManagement: "Backup Management",
      noEmailSet: "No email set",
      
      // Table headers (using existing vehicle key from main section)
      
      // Pluralization and duration
      day: "day",
      days: "days",
      duration_one: "{{count}} day",
      duration_other: "{{count}} days",
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
      
      // Auth page
      vehicleFleetManager: "Voertuig Vloot Manager",
      signInToContinue: "Meld je aan om door te gaan naar je dashboard",
      login: "Inloggen",
      register: "Registreren",
      enterCredentials: "Voer je inloggegevens in om toegang te krijgen tot je account",
      username: "Gebruikersnaam",
      yourUsername: "Je gebruikersnaam",
      password: "Wachtwoord",
      yourPassword: "Je wachtwoord",
      confirmPassword: "Bevestig Wachtwoord",
      confirmYourPassword: "Bevestig je wachtwoord",
      signingIn: "Inloggen...",
      registering: "Registreren...",
      alreadyHaveAccount: "Heb je al een account? Log hier in",
      
      // Validation messages
      usernameRequired: "Gebruikersnaam is verplicht",
      passwordRequired: "Wachtwoord is verplicht",
      usernameMinLength: "Gebruikersnaam moet minimaal 3 karakters zijn",
      passwordMinLength: "Wachtwoord moet minimaal 6 karakters zijn",
      pleaseConfirmPassword: "Bevestig je wachtwoord",
      passwordsDontMatch: "Wachtwoorden komen niet overeen",
      invalidEmail: "Ongeldig e-mailadres indien opgegeven",
      nameMinLength: "Naam moet minimaal 2 karakters zijn",
      
      // Fleet management info
      fleetManagementSystem: "Vloot Management Systeem",
      streamlineOperations: "Stroomlijn je voertuigverhuur activiteiten met ons uitgebreide managementsysteem",
      trackVehicles: "Houd voertuigen, klanten en reserveringen bij",
      generateContracts: "Genereer contracten en beheer documenten",
      monitorExpenses: "Monitor uitgaven en onderhoudswaarschuwingen",
      comprehensiveReporting: "Uitgebreide rapportage en analyses",
      
      // Form labels and fields (common)
      firstName: "Voornaam",
      lastName: "Achternaam",
      companyName: "Bedrijfsnaam",
      contactPerson: "Contactpersoon",
      driverName: "Naam Bestuurder",
      streetName: "Straatnaam",
      debtorNumber: "Debiteurennummer",
      chamberOfCommerce: "KvK Nummer",
      vatNumber: "BTW Nummer",
      description: "Beschrijving",
      amount: "Bedrag",
      category: "Categorie",
      required: "Verplicht",
      optional: "Optioneel",
      
      // Dashboard and widgets
      quickActions: "Snelle Acties",
      availableVehicles: "Beschikbare Voertuigen",
      totalVehicles: "Totaal Voertuigen",
      activeReservations: "Actieve Reserveringen",
      totalCustomers: "Totaal Klanten",
      upcomingReservations: "Aankomende Reserveringen",
      recentExpenses: "Recente Uitgaven",
      vehicleAvailability: "Voertuig Beschikbaarheid",
      apkExpirations: "APK Verlopen",
      warrantyExpirations: "Garantie Verlopen",
      noDataAvailable: "Geen gegevens beschikbaar",
      viewAll: "Bekijk Alles",
      
      // Actions and buttons
      addNew: "Nieuwe Toevoegen",
      editItem: "Bewerken",
      deleteItem: "Verwijderen",
      saveChanges: "Wijzigingen Opslaan",
      discardChanges: "Wijzigingen Verwerpen",
      confirmAction: "Bevestigen",
      cancelAction: "Annuleren",
      
      // Filters and placeholders
      allTypes: "Alle Types",
      allBrands: "Alle Merken",
      noAvailableVehicles: "Geen beschikbare voertuigen",
      noDataFound: "Geen gegevens gevonden",
      period: "Periode",
      administration: "Administratie",
      backupManagement: "Backup Beheer",
      noEmailSet: "Geen e-mail ingesteld",
      
      // Table headers (using existing vehicle key from main section)
      
      // Pluralization and duration
      day: "dag",
      days: "dagen",
      duration_one: "{{count}} dag",
      duration_other: "{{count}} dagen",
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