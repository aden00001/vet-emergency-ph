-- Seed 50 NCR emergency veterinary clinics for Metro Manila MVP launch
-- Coordinates are approximate locations across NCR cities

INSERT INTO public.clinics (name, address, phone, location, emergency_capable, owner_verified, services, hours, confidence_score)
VALUES
  ('Vets in Practice Animal Hospital', '105 Timog Ave, Quezon City', '0289271234', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0437, 14.6345), 4326)::extensions.geography, true, true, ARRAY['trauma','poisoning','respiratory'], '24/7 Emergency', 85),
  ('Animal House Veterinary Hospital', 'New Manila, Quezon City', '0272123456', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0380, 14.6200), 4326)::extensions.geography, true, true, ARRAY['trauma','poisoning'], '24/7', 82),
  ('Veterinary Specialty Hospital', '56 Sct. Rallos St, Quezon City', '0283765432', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0450, 14.6380), 4326)::extensions.geography, true, false, ARRAY['trauma','respiratory'], 'Mon-Sun 24h', 70),
  ('Pet Care Veterinary Clinic QC', 'East Ave, Quezon City', '0245678901', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0480, 14.6420), 4326)::extensions.geography, true, false, ARRAY['poisoning','respiratory'], '8AM-10PM', 65),
  ('East Avenue Veterinary Clinic', 'East Ave cor E Rodriguez, QC', '0241234567', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0490, 14.6410), 4326)::extensions.geography, true, false, ARRAY['trauma'], '24/7 Emergency', 68),
  ('Vetsmart Animal Hospital', 'Katipunan Ave, Quezon City', '0289876543', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0720, 14.6520), 4326)::extensions.geography, true, false, ARRAY['trauma','poisoning'], '9AM-9PM', 60),
  ('Quezon City Animal Medical Center', 'Visayas Ave, Quezon City', '0245671234', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0550, 14.6680), 4326)::extensions.geography, true, false, ARRAY['respiratory'], '8AM-8PM', 58),
  ('North Vet Emergency Clinic', 'Mindanao Ave, Quezon City', '0287654321', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0380, 14.6780), 4326)::extensions.geography, true, false, ARRAY['trauma','respiratory'], '24/7', 72),
  ('Commonwealth Veterinary Hospital', 'Commonwealth Ave, QC', '0243218765', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0620, 14.6850), 4326)::extensions.geography, true, false, ARRAY['poisoning'], '7AM-11PM', 55),
  ('Cubao Animal Emergency Center', 'Araneta Center, Quezon City', '0276543210', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0560, 14.6190), 4326)::extensions.geography, true, true, ARRAY['trauma','poisoning','respiratory'], '24/7', 88),

  ('Vets in Practice BGC', 'Bonifacio Global City, Taguig', '0288891234', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0509, 14.5515), 4326)::extensions.geography, true, true, ARRAY['trauma','poisoning','respiratory'], '24/7 Emergency', 90),
  ('Metro Vet Hospital Taguig', 'C5 Road, Taguig City', '0287651234', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0580, 14.5280), 4326)::extensions.geography, true, false, ARRAY['trauma'], '24/7', 75),
  ('BGC Pet Emergency Clinic', '26th St, Bonifacio Global City', '0289012345', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0470, 14.5490), 4326)::extensions.geography, true, false, ARRAY['poisoning','respiratory'], '8AM-10PM', 62),
  ('Fort Bonifacio Animal Hospital', 'McKinley Hill, Taguig', '0282345678', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0520, 14.5340), 4326)::extensions.geography, true, false, ARRAY['trauma','poisoning'], '9AM-9PM', 58),
  ('Taguig Veterinary Medical Center', 'Lower Bicutan, Taguig', '0283456789', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0650, 14.5100), 4326)::extensions.geography, true, false, ARRAY['respiratory'], '24/7', 70),

  ('Vets in Practice Makati', 'Legazpi Village, Makati', '0289871234', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0170, 14.5530), 4326)::extensions.geography, true, true, ARRAY['trauma','poisoning','respiratory'], '24/7 Emergency', 92),
  ('Makati Animal Medical Center', 'Poblacion, Makati City', '0287659876', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0244, 14.5640), 4326)::extensions.geography, true, false, ARRAY['trauma'], '24/7', 78),
  ('Rockwell Pet Emergency Clinic', 'Rockwell Center, Makati', '0289018765', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0360, 14.5650), 4326)::extensions.geography, true, false, ARRAY['poisoning'], '8AM-11PM', 64),
  ('Ayala Ave Veterinary Hospital', 'Ayala Ave, Makati', '0282348765', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0280, 14.5580), 4326)::extensions.geography, true, false, ARRAY['trauma','respiratory'], '24/7', 76),
  ('San Antonio Vet Clinic Makati', 'San Antonio, Makati', '0285674321', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0150, 14.5620), 4326)::extensions.geography, true, false, ARRAY['poisoning','respiratory'], '7AM-10PM', 55),

  ('Manila Animal Emergency Hospital', 'Ermita, Manila', '0252345678', extensions.ST_SetSRID(extensions.ST_MakePoint(120.9842, 14.5780), 4326)::extensions.geography, true, true, ARRAY['trauma','poisoning','respiratory'], '24/7', 86),
  ('University of Santo Tomas Vet Hospital', 'España Blvd, Manila', '0258765432', extensions.ST_SetSRID(extensions.ST_MakePoint(120.9890, 14.6100), 4326)::extensions.geography, true, false, ARRAY['trauma','poisoning'], '24/7', 80),
  ('Malate Veterinary Clinic', 'Malate, Manila', '0251234567', extensions.ST_SetSRID(extensions.ST_MakePoint(120.9860, 14.5680), 4326)::extensions.geography, true, false, ARRAY['respiratory'], '8AM-9PM', 58),
  ('Binondo Animal Medical Center', 'Binondo, Manila', '0256789012', extensions.ST_SetSRID(extensions.ST_MakePoint(120.9750, 14.5980), 4326)::extensions.geography, true, false, ARRAY['trauma'], '9AM-8PM', 52),
  ('Intramuros Pet Emergency', 'Intramuros, Manila', '0254321098', extensions.ST_SetSRID(extensions.ST_MakePoint(120.9740, 14.5890), 4326)::extensions.geography, true, false, ARRAY['poisoning'], '24/7', 68),

  ('Pasig Animal Hospital', 'Ortigas Center, Pasig', '0267890123', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0650, 14.5840), 4326)::extensions.geography, true, true, ARRAY['trauma','poisoning','respiratory'], '24/7 Emergency', 84),
  ('Ortigas Veterinary Medical Center', 'San Antonio, Pasig', '0265432109', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0700, 14.5780), 4326)::extensions.geography, true, false, ARRAY['trauma'], '24/7', 74),
  ('Capitol Commons Vet Clinic', 'Capitol Commons, Pasig', '0263210987', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0620, 14.5720), 4326)::extensions.geography, true, false, ARRAY['poisoning','respiratory'], '8AM-10PM', 60),
  ('Pasig Emergency Animal Care', 'C5 Pasig Blvd', '0261098765', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0851, 14.5600), 4326)::extensions.geography, true, false, ARRAY['trauma','respiratory'], '24/7', 72),
  ('Rosario Vet Hospital Pasig', 'Rosario, Pasig City', '0268765432', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0900, 14.5880), 4326)::extensions.geography, true, false, ARRAY['poisoning'], '7AM-11PM', 54),

  ('Mandaluyong Animal Medical Center', 'Shaw Blvd, Mandaluyong', '0253217654', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0359, 14.5820), 4326)::extensions.geography, true, false, ARRAY['trauma','poisoning'], '24/7', 70),
  ('SM Megamall Vet Clinic', 'Ortigas Mandaluyong', '0256549876', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0560, 14.5850), 4326)::extensions.geography, true, false, ARRAY['respiratory'], '10AM-9PM', 56),
  ('Greenfield District Vet', 'Mayflower St, Mandaluyong', '0259873210', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0420, 14.5780), 4326)::extensions.geography, true, false, ARRAY['trauma'], '8AM-8PM', 50),

  ('San Juan Animal Hospital', 'Greenhills, San Juan', '0272345678', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0355, 14.6019), 4326)::extensions.geography, true, false, ARRAY['trauma','poisoning','respiratory'], '24/7', 76),
  ('Greenhills Pet Emergency', 'Club Filipino Ave, San Juan', '0278765432', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0380, 14.6040), 4326)::extensions.geography, true, false, ARRAY['poisoning'], '9AM-9PM', 58),

  ('Paranaque Animal Emergency Center', 'BF Homes, Paranaque', '0285432109', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0198, 14.4550), 4326)::extensions.geography, true, false, ARRAY['trauma','respiratory'], '24/7', 68),
  ('Sucat Vet Hospital', 'Dr A Santos Ave, Paranaque', '0287654320', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0250, 14.4700), 4326)::extensions.geography, true, false, ARRAY['poisoning'], '8AM-10PM', 55),
  ('Aseana Animal Medical Center', 'Entertainment City, Paranaque', '0289012340', extensions.ST_SetSRID(extensions.ST_MakePoint(120.9820, 14.5280), 4326)::extensions.geography, true, true, ARRAY['trauma','poisoning','respiratory'], '24/7', 82),

  ('Las Pinas Vet Emergency Clinic', 'Alabang-Zapote Rd, Las Pinas', '0282345670', extensions.ST_SetSRID(extensions.ST_MakePoint(120.9828, 14.4350), 4326)::extensions.geography, true, false, ARRAY['trauma'], '24/7', 66),
  ('BF Resort Village Animal Hospital', 'Las Pinas City', '0285678900', extensions.ST_SetSRID(extensions.ST_MakePoint(120.9900, 14.4280), 4326)::extensions.geography, true, false, ARRAY['poisoning','respiratory'], '7AM-10PM', 52),

  ('Muntinlupa Animal Medical Center', 'Alabang, Muntinlupa', '0287654300', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0415, 14.4200), 4326)::extensions.geography, true, true, ARRAY['trauma','poisoning','respiratory'], '24/7 Emergency', 80),
  ('Filinvest Animal Hospital', 'Filinvest City, Muntinlupa', '0289012300', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0380, 14.4081), 4326)::extensions.geography, true, false, ARRAY['trauma'], '24/7', 72),
  ('South Super Vet Clinic', 'SLEX Muntinlupa', '0283456700', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0500, 14.3950), 4326)::extensions.geography, true, false, ARRAY['respiratory'], '8AM-9PM', 50),

  ('Caloocan North Vet Hospital', 'Monumento, Caloocan', '0287654100', extensions.ST_SetSRID(extensions.ST_MakePoint(120.9839, 14.6550), 4326)::extensions.geography, true, false, ARRAY['trauma','poisoning'], '24/7', 64),
  ('Grace Park Animal Clinic', 'Grace Park, Caloocan', '0289012100', extensions.ST_SetSRID(extensions.ST_MakePoint(120.9750, 14.6488), 4326)::extensions.geography, true, false, ARRAY['respiratory'], '8AM-8PM', 48),

  ('Marikina Animal Emergency Center', 'Marikina Heights', '0282345600', extensions.ST_SetSRID(extensions.ST_MakePoint(121.1029, 14.6400), 4326)::extensions.geography, true, false, ARRAY['trauma','respiratory'], '24/7', 70),
  ('LRT Santolan Vet Clinic', 'Marcos Highway, Marikina', '0285678100', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0950, 14.6300), 4326)::extensions.geography, true, false, ARRAY['poisoning'], '9AM-9PM', 54),

  ('Pasay NAIA Vet Emergency', 'NAIA Road, Pasay', '0287654000', extensions.ST_SetSRID(extensions.ST_MakePoint(121.0014, 14.5200), 4326)::extensions.geography, true, false, ARRAY['trauma','poisoning'], '24/7', 68),
  ('Diosdado Macapagal Vet Clinic', 'Entertainment City, Pasay', '0289012000', extensions.ST_SetSRID(extensions.ST_MakePoint(120.9850, 14.5378), 4326)::extensions.geography, true, false, ARRAY['respiratory'], '8AM-10PM', 56),

  ('Valenzuela Animal Medical Center', 'MacArthur Highway, Valenzuela', '0282345500', extensions.ST_SetSRID(extensions.ST_MakePoint(120.9680, 14.6950), 4326)::extensions.geography, true, false, ARRAY['trauma'], '24/7', 62),
  ('Malabon Vet Emergency Clinic', 'Malabon City', '0285678000', extensions.ST_SetSRID(extensions.ST_MakePoint(120.9600, 14.6600), 4326)::extensions.geography, true, false, ARRAY['poisoning','respiratory'], '7AM-10PM', 50),

  ('Navotas Animal Hospital', 'Navotas City', '0287653900', extensions.ST_SetSRID(extensions.ST_MakePoint(120.9400, 14.6700), 4326)::extensions.geography, true, false, ARRAY['trauma','poisoning'], '8AM-9PM', 48),
  ('Malate 24/7 Pet Emergency', 'Remedios Circle, Manila', '0258765400', extensions.ST_SetSRID(extensions.ST_MakePoint(120.9880, 14.5650), 4326)::extensions.geography, true, false, ARRAY['trauma','poisoning','respiratory'], '24/7', 74);

-- Initialize clinic status for all seeded clinics
INSERT INTO public.clinic_status (clinic_id, current_status)
SELECT id,
  CASE
    WHEN random() > 0.85 THEN 'limited'::public.clinic_status_type
    WHEN random() > 0.95 THEN 'not_accepting'::public.clinic_status_type
    ELSE 'accepting'::public.clinic_status_type
  END
FROM public.clinics;

-- Seed sample community verifications for anchor clinics
INSERT INTO public.verifications (clinic_id, verification_type, source, created_at)
SELECT c.id, 'accepting_emergencies', 'community', NOW() - (random() * INTERVAL '12 hours')
FROM public.clinics c
WHERE c.owner_verified = true
LIMIT 10;

INSERT INTO public.verifications (clinic_id, verification_type, source, created_at)
SELECT c.id, 'confirmed_open', 'owner', NOW() - (random() * INTERVAL '6 hours')
FROM public.clinics c
WHERE c.owner_verified = true
LIMIT 8;

-- Refresh confidence scores after seed
SELECT public.refresh_all_confidence_scores();
