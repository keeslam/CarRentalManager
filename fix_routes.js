const fs = require('fs');
const path = require('path');

const routesPath = path.join(process.cwd(), 'server/routes.ts');
let content = fs.readFileSync(routesPath, 'utf8');

// Replace the first occurrence (vehicle creation endpoint)
content = content.replace(
  `      // Handle registration fields
      if ('registeredTo' in sanitizedData) {
        const value = sanitizedData.registeredTo;
        sanitizedData.registeredTo = value === true || value === 'true' || value === 1 || value === '1';
      }
      
      if ('company' in sanitizedData) {
        const value = sanitizedData.company;
        sanitizedData.company = value === true || value === 'true' || value === 1 || value === '1';
      }`,
  `      // Handle registration fields - convert to strings since they're stored as text in the DB
      if ('registeredTo' in sanitizedData) {
        const value = sanitizedData.registeredTo;
        sanitizedData.registeredTo = (value === true || value === 'true' || value === 1 || value === '1') ? "true" : "false";
      }
      
      if ('company' in sanitizedData) {
        const value = sanitizedData.company;
        sanitizedData.company = (value === true || value === 'true' || value === 1 || value === '1') ? "true" : "false";
      }`
);

// Replace the second occurrence (vehicle update endpoint)
content = content.replace(
  `      // Handle registration fields
      if ('registeredTo' in sanitizedData) {
        const value = sanitizedData.registeredTo;
        sanitizedData.registeredTo = value === true || value === 'true' || value === 1 || value === '1';
      }
      
      if ('company' in sanitizedData) {
        const value = sanitizedData.company;
        sanitizedData.company = value === true || value === 'true' || value === 1 || value === '1';
      }`,
  `      // Handle registration fields - convert to strings since they're stored as text in the DB
      if ('registeredTo' in sanitizedData) {
        const value = sanitizedData.registeredTo;
        sanitizedData.registeredTo = (value === true || value === 'true' || value === 1 || value === '1') ? "true" : "false";
      }
      
      if ('company' in sanitizedData) {
        const value = sanitizedData.company;
        sanitizedData.company = (value === true || value === 'true' || value === 1 || value === '1') ? "true" : "false";
      }`
);

fs.writeFileSync(routesPath, content, 'utf8');
console.log('Routes file updated successfully!');
