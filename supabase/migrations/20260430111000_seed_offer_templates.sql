begin;

insert into public.offer_content_templates (template_name, template_type, structure, is_active, version)
values
(
  'Machine Selling Template',
  'machine_selling',
  '{"template_id":"machine_selling_v1","sections":[{"id":"cover_page","title":"Cover Page & Executive Summary","required":true},{"id":"technical_specifications","title":"Technical Specifications & Equipment Overview","required":true},{"id":"performance_guarantees","title":"Performance Guarantees & KPIs","required":false},{"id":"commercial_terms","title":"Commercial Terms","required":true},{"id":"delivery_installation","title":"Delivery, Installation & Commissioning","required":true},{"id":"service_maintenance","title":"Service & Maintenance Packages","required":false},{"id":"legal_conditions","title":"Offer & Purchase Conditions","required":true,"is_last_section":true}]}'::jsonb,
  true,
  1
),
(
  'Service Selling Template',
  'service_selling',
  '{"template_id":"service_selling_v1","sections":[{"id":"cover_page","title":"Cover Page & Service Overview","required":true},{"id":"scope_of_work","title":"Scope of Work (SoW)","required":true},{"id":"methodology","title":"Methodology & Approach","required":false},{"id":"timeline","title":"Project Timeline & Resource Allocation","required":true},{"id":"commercial_terms","title":"Commercial Terms","required":true},{"id":"governance","title":"Governance & Reporting","required":true},{"id":"service_levels","title":"Service Level Agreements (SLAs)","required":false},{"id":"legal_conditions","title":"Offer & Purchase Conditions","required":true,"is_last_section":true}]}'::jsonb,
  true,
  1
)
on conflict do nothing;

insert into public.offer_content_blocks (template_type, section_id, block_type, title, content, is_default)
values
('common', 'legal_conditions', 'conditions', 'Standard Payment Terms', 'Payment shall be made within 30 days of invoice date. Late payments incur 1.5% monthly interest.', true),
('common', 'legal_conditions', 'conditions', 'Delivery Terms (EXW)', 'Ex Works (INCOTERMS 2024). Buyer assumes all shipping costs and risks from seller''s premises.', true),
('machine_selling', 'legal_conditions', 'conditions', 'Machine Warranty', '24 months warranty on manufacturing defects. Excludes wear parts, improper use, or unauthorized modifications.', true),
('service_selling', 'legal_conditions', 'conditions', 'Intellectual Property', 'All deliverables and IP remain property of seller until full payment. Upon payment, client receives perpetual license.', true),
('common', 'legal_conditions', 'conditions', 'Confidentiality', 'Both parties agree to keep this offer confidential for 24 months.', true),
('common', 'legal_conditions', 'conditions', 'Governing Law', 'This offer is governed by the laws of [Jurisdiction]. Any disputes shall be resolved by [Court Name].', true)
on conflict do nothing;

commit;
