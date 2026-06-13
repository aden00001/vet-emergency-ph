import { resolveClinicArea } from "../src/lib/ph-regions.ts";

const cases = [
  ["R98X+H96, San Juan - Laiya Rd, San Juan, Batangas, Philippines", "ph-batangas"],
  ["M8CQ+9C8, Ili Norte, San Juan, 2514 La Union, Philippines", "ph-la-union"],
  ["5F5V+F3F, Poblacion, San Juan, Siquijor", "ph-siquijor"],
  ["# 225 San Juan Rd, Calamba, Laguna", "ph-laguna"],
  ["J24G+WJH, triple a bldg, N. Domingo, San Juan City, Metro Manila, Philippines", "ncr-san-juan"],
  ["Some St, San Juan, Metro Manila, Philippines", "ncr-san-juan"],
  ["MFWP+P8R, San Juan Evangelista St, Goa, Camarines Sur", "ph-camarines-sur"],
  ["WM22+MQH, Cagayan Valley Rd, Alcala, Cagayan", "ph-cagayan"],
  ["San Agustin, Isabela, Cagayan Valley, Philippines", "ph-isabela"],
  ["74CF+6H5, Manila S Rd, Cabuyao City, Laguna", "ph-laguna"],
  ["MX3G+3CX, General Del Pilar Street, Manila, 1000 Metro Manila, Philippines", "ncr-manila"],
  ["8WF5+GP5, Golam Dr, Cebu City, 6000 Cebu, Philippines", "ph-cebu-city"],
  ["10th St, Bacolod, 6100 Negros Occidental, Philippines", "ph-bacolod"],
  ["Talomo, Davao City, Davao del Sur, Philippines", "ph-davao-city"],
  ["102-B Makati Ave, Pasig, Metro Manila", "ncr-pasig"],
  ["1720, 8300 Dr Arcadio Santos Ave, San Antonio, Parañaque, 1715 Metro Manila, Philippines", "ncr-para-aque"],
  ["Malabon, Metro Manila, Philippines", "ncr-malabon"],
  ["314 Inquimboy, Pasay City, Metro Manila, Philippines", "ncr-pasay"],
  ["6476+82, Carmel Mall, Canlubang, Calamba City, 4027 Laguna", "ph-laguna"],
  ["8MVC+P69, Iloilo - Capiz Rd, Dao, Capiz, Philippines", "ph-capiz"],
  ["FJ9W+66F, Tomas Saco St., Cagayan De Oro City, Misamis Oriental", "ph-cagayan-de-oro"],
  ["668Q+44, 59 Macapagal Ave, Iligan City, Lanao del Norte", "ph-iligan"],
  ["XJVP+C3G, Santiago-Tuguegarao Road, Aurora, Tuguegarao City, 3500 Cagayan, Philippines", "ph-cagayan"],
  ["1260 Mabuhay Street, R-10, Barangay 44, Tondo, 1012 Metro Manila, Philippines", "ncr-manila"],
];

let fail = 0;
for (const [addr, want] of cases) {
  const got = resolveClinicArea(addr)?.id ?? null;
  const ok = got === want;
  if (!ok) fail += 1;
  console.log(`${ok ? "OK" : "FAIL"} ${want} -> ${got}`);
}
console.log(`failures ${fail}`);
process.exit(fail ? 1 : 0);
