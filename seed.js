const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const db = require('./db');

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Function to generate a valid minimal PDF buffer with custom title
function createSamplePdf(title) {
  const content = `BT /F1 20 Tf 50 720 Td (${title.replace(/[\(\)]/g, '')}) Tj /F1 12 Tf 50 690 Td (Official Library Document Archive) Tj ET`;
  const streamLength = Buffer.byteLength(content, 'utf8');

  return `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream
${content}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000234 00000 n 
0000000356 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
450
%%EOF
`;
}

function runSeed() {
  console.log('Seeding database...');

  // 1. Seed Admin
  const existingAdmin = db.prepare('SELECT * FROM admins WHERE username = ?').get('madhuri');
  if (!existingAdmin) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('m2007', salt);
    db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run('madhuri', hash);
    console.log('Admin user created successfully.');
  } else {
    console.log('Admin user already exists.');
  }

  // 2. Seed Sections and Subsections for both 'main' and 'bills'
  const seedData = [
    // Main Sections
    { panel: 'main', section: 'PRC', subsections: ['2015 PRC', '2022 PRC'] },
    { panel: 'main', section: 'Service', subsections: ['Service'] },
    { panel: 'main', section: 'Leave', subsections: ['Earned Leave', 'ML/HPL', 'EOL'] },
    { panel: 'main', section: 'UGC', subsections: ['UGC RPS-2006', 'UGC RPS-2016', 'CAS'] },
    { panel: 'main', section: 'DA', subsections: ['DA GOs'] },
    { panel: 'main', section: 'RTF', subsections: ['RTF'] },
    { panel: 'main', section: 'Fees', subsections: ['Special fee', 'Restructured fee'] },

    // Bills Sections
    { panel: 'bills', section: 'Contingent Bills', subsections: ['Office Contingency', 'Lab & Library Equipment'] },
    { panel: 'bills', section: 'Salary Bills', subsections: ['Regular Pay Bills', 'Supplementary Pay Bills'] },
    { panel: 'bills', section: 'TA Bills', subsections: ['Tour TA Bills', 'Transfer TA Bills'] },
    { panel: 'bills', section: 'Medical Reimbursement', subsections: ['Medical Reimbursement'] },
    { panel: 'bills', section: 'Scholarship Bills', subsections: ['RTF & MTF Sanctions'] }
  ];

  const getSectionStmt = db.prepare('SELECT id FROM sections WHERE name = ? AND panel = ?');
  const insertSectionStmt = db.prepare('INSERT INTO sections (name, panel) VALUES (?, ?)');
  const getSubStmt = db.prepare('SELECT id FROM subsections WHERE section_id = ? AND name = ?');
  const insertSubStmt = db.prepare('INSERT INTO subsections (section_id, name) VALUES (?, ?)');

  for (const item of seedData) {
    let sectionRow = getSectionStmt.get(item.section, item.panel);
    if (!sectionRow) {
      const res = insertSectionStmt.run(item.section, item.panel);
      sectionRow = { id: res.lastInsertRowid };
    }

    for (const sub of item.subsections) {
      const subRow = getSubStmt.get(sectionRow.id, sub);
      if (!subRow) {
        insertSubStmt.run(sectionRow.id, sub);
      }
    }
  }
  console.log('Sections and subsections (main & bills) seeded successfully.');

  // 3. Seed Sample Documents if needed
  const sampleDocs = [
    {
      panel: 'main',
      section: 'PRC',
      sub: '2015 PRC',
      title: 'Tenth Pay Revision Commission Comprehensive Order',
      description: 'Government orders and guidelines relating to the implementation of the 10th PRC recommendations.'
    },
    {
      panel: 'main',
      section: 'PRC',
      sub: '2022 PRC',
      title: 'Eleventh Pay Revision Commission Master Circular',
      description: 'Detailed instructions on revised pay scales, allowances, and fixation procedures for employees.'
    },
    {
      panel: 'main',
      section: 'Leave',
      sub: 'Earned Leave',
      title: 'Comprehensive Rules on Earned Leave & Surrender',
      description: 'Procedures for leave encashment, accumulation limits, and account maintenance.'
    },
    {
      panel: 'main',
      section: 'Leave',
      sub: 'ML/HPL',
      title: 'Medical Leave and Half Pay Leave Regulations',
      description: 'Provisions for commuted leave on medical grounds, certificates, and conversion rules.'
    },
    {
      panel: 'main',
      section: 'UGC',
      sub: 'CAS',
      title: 'Career Advancement Scheme - Performance Based Appraisal Guidelines',
      description: 'Regulations on minimum qualifications and scoring metrics for faculty promotions.'
    },
    {
      panel: 'main',
      section: 'DA',
      sub: 'DA GOs',
      title: 'Dearness Allowance Revision Order 2024',
      description: 'Sanction of enhanced Dearness Allowance to Government and University employees.'
    },
    // Bills sample documents
    {
      panel: 'bills',
      section: 'Contingent Bills',
      sub: 'Office Contingency',
      title: 'Office Contingency Voucher & Sanction Order 2024',
      description: 'Procedures for quarterly office expenditure, postal charges, and stationery claims.'
    },
    {
      panel: 'bills',
      section: 'Salary Bills',
      sub: 'Regular Pay Bills',
      title: 'Monthly Pay Bill Submission & Deduction Schedule',
      description: 'Guidelines on CPS, APGLI, GIS deductions and treasury schedule for staff salary.'
    },
    {
      panel: 'bills',
      section: 'TA Bills',
      sub: 'Tour TA Bills',
      title: 'Travelling Allowance Tour Claim Format and Eligibility Limits',
      description: 'Rates of daily allowance, mileage allowance, and submission guidelines for official tours.'
    },
    {
      panel: 'bills',
      section: 'Medical Reimbursement',
      sub: 'Medical Reimbursement',
      title: 'Medical Reimbursement Claim Checklist & Essentiality Certificate',
      description: 'Documents required for emergency and recognized hospital treatment reimbursement.'
    }
  ];

  const insertDocStmt = db.prepare(`
    INSERT INTO documents (title, description, subsection_id, file_path, file_size)
    VALUES (?, ?, ?, ?, ?)
  `);
  const checkDocStmt = db.prepare('SELECT id FROM documents WHERE title = ?');

  for (const doc of sampleDocs) {
    const existing = checkDocStmt.get(doc.title);
    if (!existing) {
      const section = getSectionStmt.get(doc.section, doc.panel);
      if (section) {
        const sub = getSubStmt.get(section.id, doc.sub);
        if (sub) {
          const safeFilename = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.pdf`;
          const filePath = path.join('uploads', safeFilename);
          const fullPath = path.join(__dirname, filePath);
          const pdfContent = createSamplePdf(doc.title);
          fs.writeFileSync(fullPath, pdfContent, 'utf8');
          const fileSize = fs.statSync(fullPath).size;

          insertDocStmt.run(doc.title, doc.description, sub.id, filePath, fileSize);
        }
      }
    }
  }
  console.log('Sample PDF documents verified and seeded.');

  console.log('\n==================================================');
  console.log('Admin Account Seeded:');
  console.log('Username: madhuri');
  console.log('Password: m2007');
  console.log('--------------------------------------------------');
  console.log('To change the admin password, run:');
  console.log('  node change-password.js <username> <new_password>');
  console.log('==================================================\n');
}

if (require.main === module) {
  runSeed();
}

module.exports = runSeed;
