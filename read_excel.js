import XLSX from 'xlsx';
const path = 'C:\\Users\\KIIT0001\\Downloads\\GridX_Test_Signal_List (1).xlsx';
const workbook = XLSX.readFile(path);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];

const cells = ['A21', 'B21', 'C21', 'D21', 'E21', 'F21', 'G21', 'H21', 'I21', 'J21', 'K21'];
cells.forEach(c => {
  const cell = worksheet[c];
  console.log(`${c}: v="${cell ? cell.v : ''}", t="${cell ? cell.t : ''}"`);
});

console.log("\nHeaders in Row 1 (A1 to K1):");
const hCells = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1', 'J1', 'K1'];
hCells.forEach(c => {
  const cell = worksheet[c];
  console.log(`${c}: v="${cell ? cell.v : ''}"`);
});
