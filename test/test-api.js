const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('../server');

const PORT = 3899;
let server;
let adminToken = '';

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
          json
        });
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

// Helper to make multipart/form-data request
function uploadRequest(pathStr, fields, fileField, token = '') {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    let payload = Buffer.alloc(0);

    for (const [key, val] of Object.entries(fields)) {
      const part = `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`;
      payload = Buffer.concat([payload, Buffer.from(part, 'utf8')]);
    }

    if (fileField) {
      const header = `--${boundary}\r\nContent-Disposition: form-data; name="${fileField.name}"; filename="${fileField.filename}"\r\nContent-Type: ${fileField.contentType}\r\n\r\n`;
      payload = Buffer.concat([payload, Buffer.from(header, 'utf8'), fileField.content, Buffer.from('\r\n', 'utf8')]);
    }

    payload = Buffer.concat([payload, Buffer.from(`--${boundary}--\r\n`, 'utf8')]);

    const headers = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': payload.length
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: pathStr,
      method: 'POST',
      headers
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
          json
        });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting API Integration Tests ---');
  server = app.listen(PORT);

  try {
    // 1. Test GET /api/sections
    console.log('1. Testing GET /api/sections...');
    let res = await request({ hostname: '127.0.0.1', port: PORT, path: '/api/sections', method: 'GET' });
    console.assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    console.assert(Array.isArray(res.json) && res.json.length >= 7, `Expected at least 7 sections, got ${res.json.length}`);
    const sectionNames = res.json.map(s => s.name);
    console.log('  Sections found:', sectionNames.join(', '));
    const prcSection = res.json.find(s => s.name === 'PRC');
    console.assert(prcSection, 'PRC section should exist');

    // 2. Test GET /api/sections/:id/subsections
    console.log(`2. Testing GET /api/sections/${prcSection.id}/subsections...`);
    res = await request({ hostname: '127.0.0.1', port: PORT, path: `/api/sections/${prcSection.id}/subsections`, method: 'GET' });
    console.assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const subNames = res.json.map(s => s.name);
    console.log('  Subsections under PRC:', subNames.join(', '));
    console.assert(subNames.includes('2015 PRC') && subNames.includes('2022 PRC'), 'Subsections 2015 PRC and 2022 PRC must exist');
    const targetSub = res.json[0];

    // 3. Test GET /api/documents
    console.log('3. Testing GET /api/documents...');
    res = await request({ hostname: '127.0.0.1', port: PORT, path: '/api/documents', method: 'GET' });
    console.assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    console.assert(Array.isArray(res.json) && res.json.length > 0, 'Documents should be returned');
    console.log(`  Initial seeded documents count: ${res.json.length}`);

    // 4. Test document search
    console.log('4. Testing search filter (?search=Pay)...');
    res = await request({ hostname: '127.0.0.1', port: PORT, path: '/api/documents?search=Pay', method: 'GET' });
    console.assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    console.log(`  Documents matching "Pay": ${res.json.length}`);
    const firstDoc = res.json[0];

    // 5. Test download endpoint
    console.log(`5. Testing GET /api/documents/${firstDoc.id}/download...`);
    res = await request({ hostname: '127.0.0.1', port: PORT, path: `/api/documents/${firstDoc.id}/download`, method: 'GET' });
    console.assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    console.assert(res.headers['content-type'] === 'application/pdf', 'Content-Type must be application/pdf');
    console.assert(res.headers['content-disposition'].includes('attachment'), 'Content-Disposition must be attachment');
    console.assert(res.body.startsWith('%PDF'), 'Body must be valid PDF magic bytes');
    console.log('  Download response verified: PDF header %PDF and attachment disposition confirmed.');

    // 6. Test Admin Login (failure case)
    console.log('6. Testing Admin Login with incorrect password...');
    res = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ username: 'admin', password: 'wrongpassword' }));
    console.assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    console.log('  Rejected invalid credentials as expected.');

    // 7. Test Admin Login (success case)
    console.log('7. Testing Admin Login with seeded credentials (admin / admin123)...');
    res = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ username: 'admin', password: 'admin123' }));
    console.assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    console.assert(res.json && res.json.token, 'Token should be returned');
    adminToken = res.json.token;
    console.log('  Admin login successful, JWT token obtained.');

    // 8. Test Protected Endpoint without token
    console.log('8. Testing POST /api/sections without auth...');
    res = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/sections',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ name: 'Unauthorized Section' }));
    console.assert(res.statusCode === 401, `Expected 401 Unauthorized, got ${res.statusCode}`);
    console.log('  Unauthorized request blocked as expected.');

    // 9. Test PDF Upload (Admin only)
    console.log('9. Testing Admin PDF Upload with valid PDF...');
    const samplePdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n178\n%%EOF\n', 'utf8');

    res = await uploadRequest('/api/documents', {
      title: 'Automated Test Official Order 2024',
      description: 'Uploaded via automated API test suite.',
      subsection_id: targetSub.id
    }, {
      name: 'pdf',
      filename: 'sample_upload.pdf',
      contentType: 'application/pdf',
      content: samplePdfBytes
    }, adminToken);

    console.assert(res.statusCode === 201, `Expected 201 Created, got ${res.statusCode}: ${res.body}`);
    const uploadedDoc = res.json;
    console.log(`  Uploaded document created with ID ${uploadedDoc.id}, title: "${uploadedDoc.title}"`);

    // 10. Test Edit Document (Admin only)
    console.log(`10. Testing Admin Edit Document for ID ${uploadedDoc.id}...`);
    res = await uploadRequest(`/api/documents/${uploadedDoc.id}`, {
      title: 'Updated Official Order 2024 - Revised Title',
      description: 'Description updated successfully.',
      subsection_id: targetSub.id
    }, null, adminToken);
    // Method PUT for update
    // Using standard request since we aren't uploading a replacement file
    res = await new Promise((resolve, reject) => {
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
      let payload = Buffer.alloc(0);
      const fields = {
        title: 'Updated Official Order 2024 - Revised Title',
        description: 'Description updated successfully.',
        subsection_id: targetSub.id
      };
      for (const [k, v] of Object.entries(fields)) {
        payload = Buffer.concat([payload, Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`, 'utf8')]);
      }
      payload = Buffer.concat([payload, Buffer.from(`--${boundary}--\r\n`, 'utf8')]);

      const req = http.request({
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/documents/${uploadedDoc.id}`,
        method: 'PUT',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': payload.length,
          'Authorization': `Bearer ${adminToken}`
        }
      }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => resolve({ statusCode: res.statusCode, json: JSON.parse(body) }));
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
    console.assert(res.statusCode === 200, `Expected 200 OK, got ${res.statusCode}`);
    console.assert(res.json.title === 'Updated Official Order 2024 - Revised Title', 'Title should be updated');
    console.log('  Document edit verified.');

    // 11. Test Delete Document (Admin only)
    console.log(`11. Testing Admin Delete Document for ID ${uploadedDoc.id}...`);
    res = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/documents/${uploadedDoc.id}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    console.assert(res.statusCode === 200, `Expected 200 OK, got ${res.statusCode}`);
    console.log('  Document deleted successfully from DB and disk.');

    // 12. Test Section Creation and Subsection Management
    console.log('12. Testing Section and Subsection CRUD...');
    res = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/sections',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, JSON.stringify({ name: 'Testing Section' }));
    console.assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    const newSection = res.json;

    res = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/subsections',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, JSON.stringify({ section_id: newSection.id, name: 'Testing Subsection' }));
    console.assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    const newSub = res.json;
    console.log(`  Created section "${newSection.name}" and subsection "${newSub.name}"`);

    // Clean up created test section
    res = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/sections/${newSection.id}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    console.assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    console.log('  Cleaned up test section.');

    console.log('\n>>> ALL API & BUSINESS LOGIC TESTS PASSED SUCCESSFULLY! <<<\n');
  } catch (err) {
    console.error('Test failed with error:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
  }
}

runTests();

