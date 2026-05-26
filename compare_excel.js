import XLSX from 'xlsx';
import fs from 'fs';

const p1 = 'C:\\Users\\KIIT0001\\Downloads\\GridX_Test_Signal_List.xlsx';
const p2 = 'C:\\Users\\KIIT0001\\Downloads\\GridX_Test_Signal_List (1).xlsx';

const f1 = fs.readFileSync(p1);
const f2 = fs.readFileSync(p2);
console.log("File sizes match:", f1.length === f2.length);

const w1 = XLSX.readFile(p1);
const w2 = XLSX.readFile(p2);

const d1 = XLSX.utils.sheet_to_json(w1.Sheets[w1.SheetNames[0]], { header: 1 });
const d2 = XLSX.utils.sheet_to_json(w2.Sheets[w2.SheetNames[0]], { header: 1 });

console.log("Data lengths:", d1.length, d2.length);

let diffCount = 0;
for (let i = 0; i < Math.max(d1.length, d2.length); i++) {
  const r1 = JSON.stringify(d1[i] || []);
  const r2 = JSON.stringify(d2[i] || []);
  if (r1 !== r2) {
    console.log(`Diff at Row ${i}:`);
    console.log(`  File 1:`, r1);
    console.log(`  File 2:`, r2);
    diffCount++;
  }
}
console.log("Total differences:", diffCount);
