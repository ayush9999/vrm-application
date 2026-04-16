-- ============================================================
-- Seed: Standard Review Packs (8 packs)
-- ============================================================
-- These are global/standard packs (org_id = NULL, source_type = 'standard').
-- Every org can see them. Orgs can also create custom packs.
-- ============================================================

-- ─── 1. Legal & Contract ─────────────────────────────────────────────────────

INSERT INTO review_packs (id, org_id, name, code, description, source_type, applicability_rules, review_cadence) VALUES
('11111111-0001-0001-0001-000000000001', NULL, 'Legal & Contract', 'LEGAL_CONTRACT',
 'Covers contract execution, legal entity verification, NDA, DPA, and liability terms.',
 'standard',
 '{"always": true}',
 'annual')
ON CONFLICT (code) WHERE code IS NOT NULL AND deleted_at IS NULL DO NOTHING;

-- Evidence requirements
INSERT INTO evidence_requirements (id, org_id, review_pack_id, name, code, description, required, expiry_applies, sort_order) VALUES
('22222222-0001-0001-0001-000000000001', NULL, '11111111-0001-0001-0001-000000000001', 'Signed Contract', 'LEGAL_CONTRACT_01', 'Fully executed master services agreement or equivalent', true, true, 1),
('22222222-0001-0001-0001-000000000002', NULL, '11111111-0001-0001-0001-000000000001', 'Non-Disclosure Agreement', 'LEGAL_NDA_01', 'Signed mutual or one-way NDA', true, true, 2),
('22222222-0001-0001-0001-000000000003', NULL, '11111111-0001-0001-0001-000000000001', 'Company Registration', 'LEGAL_COMPREG_01', 'Certificate of incorporation or equivalent', true, false, 3),
('22222222-0001-0001-0001-000000000004', NULL, '11111111-0001-0001-0001-000000000001', 'Tax / VAT Certificate', 'LEGAL_TAX_01', 'Tax registration or GST certificate', true, true, 4),
('22222222-0001-0001-0001-000000000005', NULL, '11111111-0001-0001-0001-000000000001', 'Data Processing Agreement', 'LEGAL_DPA_01', 'DPA if vendor processes personal data', false, true, 5)
ON CONFLICT DO NOTHING;

-- Review requirements
INSERT INTO review_requirements (id, org_id, review_pack_id, name, code, description, required, linked_evidence_requirement_id, compliance_references, creates_remediation_on_fail, sort_order) VALUES
('33333333-0001-0001-0001-000000000001', NULL, '11111111-0001-0001-0001-000000000001', 'Legal entity verified', 'LEGAL_REV_01', 'Confirm the vendor is a registered legal entity with valid incorporation documents.', true, '22222222-0001-0001-0001-000000000003', '[]', true, 1),
('33333333-0001-0001-0001-000000000002', NULL, '11111111-0001-0001-0001-000000000001', 'Required contract clauses present', 'LEGAL_REV_02', 'Verify that the contract includes all required clauses: scope, payment, liability, termination, IP ownership.', true, '22222222-0001-0001-0001-000000000001', '[]', true, 2),
('33333333-0001-0001-0001-000000000003', NULL, '11111111-0001-0001-0001-000000000001', 'NDA signed and in force', 'LEGAL_REV_03', 'Confirm a valid NDA is in place covering all shared confidential information.', true, '22222222-0001-0001-0001-000000000002', '[]', true, 3),
('33333333-0001-0001-0001-000000000004', NULL, '11111111-0001-0001-0001-000000000001', 'DPA in place where needed', 'LEGAL_REV_04', 'If vendor processes personal data, confirm a DPA is executed with adequate data protection terms.', false, '22222222-0001-0001-0001-000000000005', '[{"standard":"GDPR","reference":"Art 28"}]', true, 4),
('33333333-0001-0001-0001-000000000005', NULL, '11111111-0001-0001-0001-000000000001', 'Liability and indemnity acceptable', 'LEGAL_REV_05', 'Verify that liability caps and indemnity provisions are within acceptable thresholds.', true, '22222222-0001-0001-0001-000000000001', '[]', false, 5),
('33333333-0001-0001-0001-000000000006', NULL, '11111111-0001-0001-0001-000000000001', 'Termination clause acceptable', 'LEGAL_REV_06', 'Confirm the contract includes reasonable termination and exit provisions.', true, '22222222-0001-0001-0001-000000000001', '[]', false, 6),
('33333333-0001-0001-0001-000000000007', NULL, '11111111-0001-0001-0001-000000000001', 'Breach notification obligations defined', 'LEGAL_REV_07', 'Verify breach/incident notification timelines and obligations are documented.', true, '22222222-0001-0001-0001-000000000001', '[]', true, 7)
ON CONFLICT DO NOTHING;

-- ─── 2. Financial Stability ──────────────────────────────────────────────────

INSERT INTO review_packs (id, org_id, name, code, description, source_type, applicability_rules, review_cadence) VALUES
('11111111-0001-0001-0002-000000000001', NULL, 'Financial Stability', 'FINANCIAL_STABILITY',
 'Assesses vendor financial health, insurance, and concentration risk.',
 'standard',
 '{"min_criticality_tier": 2}',
 'annual')
ON CONFLICT (code) WHERE code IS NOT NULL AND deleted_at IS NULL DO NOTHING;

INSERT INTO evidence_requirements (id, org_id, review_pack_id, name, code, description, required, expiry_applies, sort_order) VALUES
('22222222-0001-0002-0001-000000000001', NULL, '11111111-0001-0001-0002-000000000001', 'Financial Statements (2 years)', 'FIN_STATEMENTS_01', 'Audited or management accounts for the last 2 financial years', true, false, 1),
('22222222-0001-0002-0001-000000000002', NULL, '11111111-0001-0001-0002-000000000001', 'Insurance Certificate', 'FIN_INSURANCE_01', 'Professional indemnity, public liability, or equivalent', true, true, 2),
('22222222-0001-0002-0001-000000000003', NULL, '11111111-0001-0001-0002-000000000001', 'Credit Reference', 'FIN_CREDIT_01', 'Credit report or Dun & Bradstreet rating if available', false, false, 3)
ON CONFLICT DO NOTHING;

INSERT INTO review_requirements (id, org_id, review_pack_id, name, code, description, required, linked_evidence_requirement_id, compliance_references, creates_remediation_on_fail, sort_order) VALUES
('33333333-0001-0002-0001-000000000001', NULL, '11111111-0001-0001-0002-000000000001', 'Financially stable based on statements', 'FIN_REV_01', 'Review financial statements for signs of going concern, declining revenue, or unsustainable losses.', true, '22222222-0001-0002-0001-000000000001', '[]', true, 1),
('33333333-0001-0002-0001-000000000002', NULL, '11111111-0001-0001-0002-000000000001', 'No bankruptcy or distress indicators', 'FIN_REV_02', 'Verify no pending bankruptcy, administration, or distress proceedings.', true, NULL, '[]', true, 2),
('33333333-0001-0002-0001-000000000003', NULL, '11111111-0001-0001-0002-000000000001', 'Insurance valid and sufficient', 'FIN_REV_03', 'Confirm insurance coverage is current and meets minimum thresholds for the engagement.', true, '22222222-0001-0002-0001-000000000002', '[]', true, 3),
('33333333-0001-0002-0001-000000000004', NULL, '11111111-0001-0001-0002-000000000001', 'Concentration risk acceptable', 'FIN_REV_04', 'Assess whether vendor revenue dependency on your org creates unacceptable concentration risk.', true, NULL, '[]', false, 4),
('33333333-0001-0002-0001-000000000005', NULL, '11111111-0001-0001-0002-000000000001', 'Payment terms agreed', 'FIN_REV_05', 'Confirm payment terms (net days, currency, invoicing frequency) are documented and agreed.', true, NULL, '[]', false, 5)
ON CONFLICT DO NOTHING;

-- ─── 3. Privacy & Data Protection ────────────────────────────────────────────

INSERT INTO review_packs (id, org_id, name, code, description, source_type, applicability_rules, review_cadence) VALUES
('11111111-0001-0001-0003-000000000001', NULL, 'Privacy & Data Protection', 'PRIVACY_DATA',
 'Covers personal data handling, DPA compliance, subprocessors, and cross-border transfers.',
 'standard',
 '{"processes_personal_data": true}',
 'annual')
ON CONFLICT (code) WHERE code IS NOT NULL AND deleted_at IS NULL DO NOTHING;

INSERT INTO evidence_requirements (id, org_id, review_pack_id, name, code, description, required, expiry_applies, sort_order) VALUES
('22222222-0001-0003-0001-000000000001', NULL, '11111111-0001-0001-0003-000000000001', 'Data Processing Agreement', 'PRIV_DPA_01', 'Executed DPA covering personal data processing terms', true, true, 1),
('22222222-0001-0003-0001-000000000002', NULL, '11111111-0001-0001-0003-000000000001', 'Subprocessor List', 'PRIV_SUBPROC_01', 'Current list of all subprocessors and their locations', true, false, 2),
('22222222-0001-0003-0001-000000000003', NULL, '11111111-0001-0001-0003-000000000001', 'Data Retention Policy', 'PRIV_RETENTION_01', 'Vendor data retention and deletion policy', true, false, 3),
('22222222-0001-0003-0001-000000000004', NULL, '11111111-0001-0001-0003-000000000001', 'Cross-Border Transfer Basis', 'PRIV_TRANSFER_01', 'SCCs, adequacy decision, or other transfer mechanism documentation', false, false, 4)
ON CONFLICT DO NOTHING;

INSERT INTO review_requirements (id, org_id, review_pack_id, name, code, description, required, linked_evidence_requirement_id, compliance_references, creates_remediation_on_fail, sort_order) VALUES
('33333333-0001-0003-0001-000000000001', NULL, '11111111-0001-0001-0003-000000000001', 'DPA executed', 'PRIV_REV_01', 'Confirm a compliant DPA is signed and covers all processing activities.', true, '22222222-0001-0003-0001-000000000001', '[{"standard":"GDPR","reference":"Art 28"}]', true, 1),
('33333333-0001-0003-0001-000000000002', NULL, '11111111-0001-0001-0003-000000000001', 'Personal data handling defined', 'PRIV_REV_02', 'Verify what personal data is processed, purpose, and lawful basis are documented.', true, NULL, '[{"standard":"GDPR","reference":"Art 30"}]', true, 2),
('33333333-0001-0003-0001-000000000003', NULL, '11111111-0001-0001-0003-000000000001', 'Retention and deletion confirmed', 'PRIV_REV_03', 'Confirm vendor has retention periods aligned with your policy and can execute deletion.', true, '22222222-0001-0003-0001-000000000003', '[{"standard":"GDPR","reference":"Art 17"}]', true, 3),
('33333333-0001-0003-0001-000000000004', NULL, '11111111-0001-0001-0003-000000000001', 'Cross-border transfer basis valid', 'PRIV_REV_04', 'If data transfers outside EEA/UK, verify a valid transfer mechanism is in place.', false, '22222222-0001-0003-0001-000000000004', '[{"standard":"GDPR","reference":"Art 46"}]', true, 4),
('33333333-0001-0003-0001-000000000005', NULL, '11111111-0001-0001-0003-000000000001', 'Subprocessors disclosed and acceptable', 'PRIV_REV_05', 'Confirm all subprocessors are listed, assessed, and notification process is agreed.', true, '22222222-0001-0003-0001-000000000002', '[{"standard":"GDPR","reference":"Art 28(2)"}]', true, 5),
('33333333-0001-0003-0001-000000000006', NULL, '11111111-0001-0001-0003-000000000001', 'Breach notification timeline agreed', 'PRIV_REV_06', 'Verify breach notification obligations are defined (typically 72 hours or less).', true, NULL, '[{"standard":"GDPR","reference":"Art 33"}]', true, 6)
ON CONFLICT DO NOTHING;

-- ─── 4. Security ─────────────────────────────────────────────────────────────

INSERT INTO review_packs (id, org_id, name, code, description, source_type, applicability_rules, review_cadence) VALUES
('11111111-0001-0001-0004-000000000001', NULL, 'Security', 'SECURITY',
 'Covers information security controls, certifications, vulnerability management, and incident response.',
 'standard',
 '{"data_access_levels": ["personal_data", "sensitive_personal_data", "financial_data"]}',
 'annual')
ON CONFLICT (code) WHERE code IS NOT NULL AND deleted_at IS NULL DO NOTHING;

INSERT INTO evidence_requirements (id, org_id, review_pack_id, name, code, description, required, expiry_applies, sort_order) VALUES
('22222222-0001-0004-0001-000000000001', NULL, '11111111-0001-0001-0004-000000000001', 'Security Certification', 'SEC_CERT_01', 'ISO 27001, SOC 2 Type II, or equivalent security attestation', true, true, 1),
('22222222-0001-0004-0001-000000000002', NULL, '11111111-0001-0001-0004-000000000001', 'Security Policy', 'SEC_POLICY_01', 'Information security policy document', true, false, 2),
('22222222-0001-0004-0001-000000000003', NULL, '11111111-0001-0001-0004-000000000001', 'Penetration Test Summary', 'SEC_PENTEST_01', 'Summary or executive report from most recent penetration test', false, true, 3),
('22222222-0001-0004-0001-000000000004', NULL, '11111111-0001-0001-0004-000000000001', 'BCP / DR Summary', 'SEC_BCPDR_01', 'Business continuity and disaster recovery plan summary', true, false, 4)
ON CONFLICT DO NOTHING;

INSERT INTO review_requirements (id, org_id, review_pack_id, name, code, description, required, linked_evidence_requirement_id, compliance_references, creates_remediation_on_fail, sort_order) VALUES
('33333333-0001-0004-0001-000000000001', NULL, '11111111-0001-0001-0004-000000000001', 'Security attestation valid', 'SEC_REV_01', 'Verify vendor holds a current, valid security certification or has completed a SOC 2 audit.', true, '22222222-0001-0004-0001-000000000001', '[{"standard":"ISO 27001","reference":"Full"},{"standard":"SOC 2","reference":"CC1-CC9"}]', true, 1),
('33333333-0001-0004-0001-000000000002', NULL, '11111111-0001-0001-0004-000000000001', 'Access controls acceptable', 'SEC_REV_02', 'Confirm vendor implements role-based access control, MFA, and least-privilege principles.', true, '22222222-0001-0004-0001-000000000002', '[{"standard":"SOC 2","reference":"CC6.1"}]', true, 2),
('33333333-0001-0004-0001-000000000003', NULL, '11111111-0001-0001-0004-000000000001', 'Encryption standards met', 'SEC_REV_03', 'Verify data is encrypted at rest and in transit using current standards (AES-256, TLS 1.2+).', true, NULL, '[{"standard":"SOC 2","reference":"CC6.7"}]', true, 3),
('33333333-0001-0004-0001-000000000004', NULL, '11111111-0001-0001-0004-000000000001', 'Vulnerability management exists', 'SEC_REV_04', 'Confirm vendor has a patch management and vulnerability scanning program in place.', true, '22222222-0001-0004-0001-000000000003', '[{"standard":"ISO 27001","reference":"A.12.6"}]', true, 4),
('33333333-0001-0004-0001-000000000005', NULL, '11111111-0001-0001-0004-000000000001', 'Incident response plan defined', 'SEC_REV_05', 'Verify vendor has a documented incident response plan with defined escalation and communication procedures.', true, NULL, '[]', true, 5),
('33333333-0001-0004-0001-000000000006', NULL, '11111111-0001-0001-0004-000000000001', 'BCP tested and current', 'SEC_REV_06', 'Confirm the BCP/DR plan has been tested within the last 12 months.', true, '22222222-0001-0004-0001-000000000004', '[]', false, 6)
ON CONFLICT DO NOTHING;

-- ─── 5. Operational Capability ───────────────────────────────────────────────

INSERT INTO review_packs (id, org_id, name, code, description, source_type, applicability_rules, review_cadence) VALUES
('11111111-0001-0001-0005-000000000001', NULL, 'Operational Capability', 'OPERATIONAL',
 'Covers service delivery readiness, insurance, BCP, escalation, and subcontractor management.',
 'standard',
 '{"service_types": ["supplier", "logistics"]}',
 'annual')
ON CONFLICT (code) WHERE code IS NOT NULL AND deleted_at IS NULL DO NOTHING;

INSERT INTO evidence_requirements (id, org_id, review_pack_id, name, code, description, required, expiry_applies, sort_order) VALUES
('22222222-0001-0005-0001-000000000001', NULL, '11111111-0001-0001-0005-000000000001', 'Insurance Certificate', 'OPS_INSURANCE_01', 'Public liability, professional indemnity, or goods-in-transit insurance', true, true, 1),
('22222222-0001-0005-0001-000000000002', NULL, '11111111-0001-0001-0005-000000000001', 'BCP Summary', 'OPS_BCP_01', 'Business continuity plan summary', true, false, 2),
('22222222-0001-0005-0001-000000000003', NULL, '11111111-0001-0001-0005-000000000001', 'Key Contacts / Escalation List', 'OPS_CONTACTS_01', 'Named contacts and escalation matrix', true, false, 3),
('22222222-0001-0005-0001-000000000004', NULL, '11111111-0001-0001-0005-000000000001', 'Subcontractor List', 'OPS_SUBCON_01', 'List of subcontractors used in service delivery, if applicable', false, false, 4)
ON CONFLICT DO NOTHING;

INSERT INTO review_requirements (id, org_id, review_pack_id, name, code, description, required, linked_evidence_requirement_id, compliance_references, creates_remediation_on_fail, sort_order) VALUES
('33333333-0001-0005-0001-000000000001', NULL, '11111111-0001-0001-0005-000000000001', 'Service delivery capability confirmed', 'OPS_REV_01', 'Verify vendor has the capacity, skills, and resources to deliver the contracted services.', true, NULL, '[]', true, 1),
('33333333-0001-0005-0001-000000000002', NULL, '11111111-0001-0001-0005-000000000001', 'Insurance valid', 'OPS_REV_02', 'Confirm insurance coverage is current and appropriate for the engagement scope.', true, '22222222-0001-0005-0001-000000000001', '[]', true, 2),
('33333333-0001-0005-0001-000000000003', NULL, '11111111-0001-0001-0005-000000000001', 'BCP exists and acceptable', 'OPS_REV_03', 'Verify a business continuity plan is in place and has been reviewed or tested.', true, '22222222-0001-0005-0001-000000000002', '[]', true, 3),
('33333333-0001-0005-0001-000000000004', NULL, '11111111-0001-0001-0005-000000000001', 'Escalation contacts provided', 'OPS_REV_04', 'Confirm named contacts and escalation paths are documented and current.', true, '22222222-0001-0005-0001-000000000003', '[]', false, 4),
('33333333-0001-0005-0001-000000000005', NULL, '11111111-0001-0001-0005-000000000001', 'Subcontractor dependency acceptable', 'OPS_REV_05', 'If subcontractors are used, verify they are disclosed, approved, and covered by contract.', false, '22222222-0001-0005-0001-000000000004', '[]', false, 5),
('33333333-0001-0005-0001-000000000006', NULL, '11111111-0001-0001-0005-000000000001', 'Geographic concentration risk acceptable', 'OPS_REV_06', 'Assess whether the vendor operates from a single location creating single-point-of-failure risk.', true, NULL, '[]', false, 6)
ON CONFLICT DO NOTHING;

-- ─── 6. Quality & Safety ─────────────────────────────────────────────────────

INSERT INTO review_packs (id, org_id, name, code, description, source_type, applicability_rules, review_cadence) VALUES
('11111111-0001-0001-0006-000000000001', NULL, 'Quality & Safety', 'QUALITY_SAFETY',
 'Covers quality management certifications, EHS compliance, and product/process safety.',
 'standard',
 '{"service_types": ["supplier", "logistics"]}',
 'annual')
ON CONFLICT (code) WHERE code IS NOT NULL AND deleted_at IS NULL DO NOTHING;

INSERT INTO evidence_requirements (id, org_id, review_pack_id, name, code, description, required, expiry_applies, sort_order) VALUES
('22222222-0001-0006-0001-000000000001', NULL, '11111111-0001-0001-0006-000000000001', 'Quality Certificate', 'QS_CERT_01', 'ISO 9001 or equivalent quality management certification', true, true, 1),
('22222222-0001-0006-0001-000000000002', NULL, '11111111-0001-0001-0006-000000000001', 'Safety / EHS Compliance', 'QS_EHS_01', 'Environmental, health, and safety compliance documentation', true, false, 2),
('22222222-0001-0006-0001-000000000003', NULL, '11111111-0001-0001-0006-000000000001', 'Product / Process Certification', 'QS_PRODUCT_01', 'Product certifications, testing reports, or process validation documents', false, true, 3),
('22222222-0001-0006-0001-000000000004', NULL, '11111111-0001-0001-0006-000000000001', 'Calibration / Testing Records', 'QS_CALIBRATION_01', 'Equipment calibration certificates or testing records if applicable', false, true, 4)
ON CONFLICT DO NOTHING;

INSERT INTO review_requirements (id, org_id, review_pack_id, name, code, description, required, linked_evidence_requirement_id, compliance_references, creates_remediation_on_fail, sort_order) VALUES
('33333333-0001-0006-0001-000000000001', NULL, '11111111-0001-0001-0006-000000000001', 'Quality certification valid', 'QS_REV_01', 'Verify ISO 9001 or equivalent quality certification is current and in scope.', true, '22222222-0001-0006-0001-000000000001', '[{"standard":"ISO 9001","reference":"Full"}]', true, 1),
('33333333-0001-0006-0001-000000000002', NULL, '11111111-0001-0001-0006-000000000001', 'Safety compliance confirmed', 'QS_REV_02', 'Confirm the vendor meets applicable workplace safety and regulatory requirements.', true, '22222222-0001-0006-0001-000000000002', '[]', true, 2),
('33333333-0001-0006-0001-000000000003', NULL, '11111111-0001-0001-0006-000000000001', 'EHS requirements met', 'QS_REV_03', 'Verify environmental, health, and safety obligations are acknowledged and managed.', true, NULL, '[]', true, 3),
('33333333-0001-0006-0001-000000000004', NULL, '11111111-0001-0001-0006-000000000001', 'Defect and recall process defined', 'QS_REV_04', 'Confirm the vendor has a documented defect notification and recall/remediation process.', true, NULL, '[]', true, 4)
ON CONFLICT DO NOTHING;

-- ─── 7. ESG & Supplier Conduct ───────────────────────────────────────────────

INSERT INTO review_packs (id, org_id, name, code, description, source_type, applicability_rules, review_cadence) VALUES
('11111111-0001-0001-0007-000000000001', NULL, 'ESG & Supplier Conduct', 'ESG_CONDUCT',
 'Covers supplier code of conduct, environmental declarations, anti-bribery, and labor practices.',
 'standard',
 '{"requires_esg_setting": true}',
 'annual')
ON CONFLICT (code) WHERE code IS NOT NULL AND deleted_at IS NULL DO NOTHING;

INSERT INTO evidence_requirements (id, org_id, review_pack_id, name, code, description, required, expiry_applies, sort_order) VALUES
('22222222-0001-0007-0001-000000000001', NULL, '11111111-0001-0001-0007-000000000001', 'Signed Supplier Code of Conduct', 'ESG_COC_01', 'Signed acknowledgement of your supplier code of conduct', true, false, 1),
('22222222-0001-0007-0001-000000000002', NULL, '11111111-0001-0001-0007-000000000001', 'Environmental Declaration', 'ESG_ENV_01', 'Environmental policy or sustainability commitment statement', false, false, 2),
('22222222-0001-0007-0001-000000000003', NULL, '11111111-0001-0001-0007-000000000001', 'Anti-Bribery Declaration', 'ESG_ANTIBRIBERY_01', 'Anti-bribery and anti-corruption policy or signed declaration', true, false, 3)
ON CONFLICT DO NOTHING;

INSERT INTO review_requirements (id, org_id, review_pack_id, name, code, description, required, linked_evidence_requirement_id, compliance_references, creates_remediation_on_fail, sort_order) VALUES
('33333333-0001-0007-0001-000000000001', NULL, '11111111-0001-0001-0007-000000000001', 'Code of conduct signed', 'ESG_REV_01', 'Verify the vendor has signed or acknowledged your supplier code of conduct.', true, '22222222-0001-0007-0001-000000000001', '[]', true, 1),
('33333333-0001-0007-0001-000000000002', NULL, '11111111-0001-0001-0007-000000000001', 'Labor practices acceptable', 'ESG_REV_02', 'Confirm the vendor does not engage in forced labor, child labor, or discriminatory practices.', true, NULL, '[]', true, 2),
('33333333-0001-0007-0001-000000000003', NULL, '11111111-0001-0001-0007-000000000001', 'Anti-bribery commitment confirmed', 'ESG_REV_03', 'Verify the vendor has an anti-bribery policy or has signed an anti-corruption declaration.', true, '22222222-0001-0007-0001-000000000003', '[]', true, 3),
('33333333-0001-0007-0001-000000000004', NULL, '11111111-0001-0001-0007-000000000001', 'Environmental obligations acknowledged', 'ESG_REV_04', 'Confirm the vendor acknowledges environmental responsibilities relevant to the engagement.', false, '22222222-0001-0007-0001-000000000002', '[]', false, 4),
('33333333-0001-0007-0001-000000000005', NULL, '11111111-0001-0001-0007-000000000001', 'Grievance mechanism exists', 'ESG_REV_05', 'Verify the vendor has a mechanism for workers or stakeholders to raise concerns.', false, NULL, '[]', false, 5)
ON CONFLICT DO NOTHING;

-- ─── 8. Business Continuity ──────────────────────────────────────────────────

INSERT INTO review_packs (id, org_id, name, code, description, source_type, applicability_rules, review_cadence) VALUES
('11111111-0001-0001-0008-000000000001', NULL, 'Business Continuity', 'BUSINESS_CONTINUITY',
 'Covers BCP, disaster recovery, key-person dependency, and alternate supply arrangements.',
 'standard',
 '{"min_criticality_tier": 2}',
 'annual')
ON CONFLICT (code) WHERE code IS NOT NULL AND deleted_at IS NULL DO NOTHING;

INSERT INTO evidence_requirements (id, org_id, review_pack_id, name, code, description, required, expiry_applies, sort_order) VALUES
('22222222-0001-0008-0001-000000000001', NULL, '11111111-0001-0001-0008-000000000001', 'BCP Document', 'BC_BCP_01', 'Business continuity plan document', true, false, 1),
('22222222-0001-0008-0001-000000000002', NULL, '11111111-0001-0001-0008-000000000001', 'DR Summary', 'BC_DR_01', 'Disaster recovery plan or summary', true, false, 2),
('22222222-0001-0008-0001-000000000003', NULL, '11111111-0001-0001-0008-000000000001', 'Alternate Supplier / Site Details', 'BC_ALT_01', 'Documentation of alternate supplier arrangements or failover sites if applicable', false, false, 3)
ON CONFLICT DO NOTHING;

INSERT INTO review_requirements (id, org_id, review_pack_id, name, code, description, required, linked_evidence_requirement_id, compliance_references, creates_remediation_on_fail, sort_order) VALUES
('33333333-0001-0008-0001-000000000001', NULL, '11111111-0001-0001-0008-000000000001', 'BCP documented and tested', 'BC_REV_01', 'Verify the vendor has a documented BCP that has been tested within the last 12 months.', true, '22222222-0001-0008-0001-000000000001', '[]', true, 1),
('33333333-0001-0008-0001-000000000002', NULL, '11111111-0001-0001-0008-000000000001', 'DR plan acceptable', 'BC_REV_02', 'Confirm the disaster recovery plan covers the services provided to you and has been tested.', true, '22222222-0001-0008-0001-000000000002', '[]', true, 2),
('33333333-0001-0008-0001-000000000003', NULL, '11111111-0001-0001-0008-000000000001', 'Key-person dependency risk acceptable', 'BC_REV_03', 'Assess whether the vendor''s service delivery depends critically on specific individuals.', true, NULL, '[]', false, 3),
('33333333-0001-0008-0001-000000000004', NULL, '11111111-0001-0001-0008-000000000001', 'Alternate supply or failover exists', 'BC_REV_04', 'If single-source, verify whether an alternate supplier or failover arrangement exists.', false, '22222222-0001-0008-0001-000000000003', '[]', false, 4),
('33333333-0001-0008-0001-000000000005', NULL, '11111111-0001-0001-0008-000000000001', 'Recovery time expectations agreed', 'BC_REV_05', 'Confirm RTO/RPO expectations are documented and achievable based on the vendor''s DR plan.', true, NULL, '[]', true, 5)
ON CONFLICT DO NOTHING;

-- ============================================================
-- End of review pack seeds
-- ============================================================
