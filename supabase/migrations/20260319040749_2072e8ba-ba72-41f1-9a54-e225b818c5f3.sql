
-- Booking settings (on/off module per store)
CREATE TABLE public.booking_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT false,
  service_name text NOT NULL DEFAULT 'บริการ',
  slot_duration_minutes integer NOT NULL DEFAULT 60,
  max_advance_days integer NOT NULL DEFAULT 30,
  auto_confirm boolean NOT NULL DEFAULT false,
  business_hours jsonb NOT NULL DEFAULT '[{"day": 1, "open": "09:00", "close": "18:00"}, {"day": 2, "open": "09:00", "close": "18:00"}, {"day": 3, "open": "09:00", "close": "18:00"}, {"day": 4, "open": "09:00", "close": "18:00"}, {"day": 5, "open": "09:00", "close": "18:00"}]'::jsonb,
  booking_rules text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Booking slots (available time slots)
CREATE TABLE public.booking_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  max_bookings integer NOT NULL DEFAULT 1,
  current_bookings integer NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(slot_date, start_time, end_time)
);

-- Bookings table
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_line_id text NULL,
  customer_facebook_id text NULL,
  platform text NOT NULL DEFAULT 'web',
  slot_id uuid REFERENCES public.booking_slots(id) ON DELETE SET NULL,
  booking_date date NOT NULL,
  booking_time time NOT NULL,
  service_name text NOT NULL DEFAULT 'บริการ',
  notes text NULL,
  status text NOT NULL DEFAULT 'pending',
  conversation_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- booking_settings: admin manage, anyone view
CREATE POLICY "Admins can manage booking settings" ON public.booking_settings FOR ALL TO public USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can view booking settings" ON public.booking_settings FOR SELECT TO public USING (true);

-- booking_slots: admin manage, anyone view available
CREATE POLICY "Admins can manage booking slots" ON public.booking_slots FOR ALL TO public USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can view available slots" ON public.booking_slots FOR SELECT TO public USING (is_available = true);

-- bookings: admin manage all, anon can create
CREATE POLICY "Admins can manage all bookings" ON public.bookings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can create bookings" ON public.bookings FOR INSERT TO anon, authenticated WITH CHECK (
  has_role(auth.uid(), 'admin') OR customer_line_id IS NOT NULL OR customer_facebook_id IS NOT NULL OR platform = 'web'
);
CREATE POLICY "Anyone can view bookings by booking_number" ON public.bookings FOR SELECT TO anon USING (true);

-- Generate booking number trigger
CREATE OR REPLACE FUNCTION public.generate_booking_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.booking_number := 'BK-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_generate_booking_number
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_booking_number();

-- Notify admin on new booking
CREATE OR REPLACE FUNCTION public.notify_new_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, title, message, data)
  VALUES (
    'new_booking',
    'การจองใหม่!',
    'มีการจอง ' || NEW.booking_number || ' จาก ' || NEW.customer_name || ' วันที่ ' || NEW.booking_date || ' เวลา ' || NEW.booking_time,
    jsonb_build_object('booking_id', NEW.id, 'booking_number', NEW.booking_number, 'customer_name', NEW.customer_name, 'booking_date', NEW.booking_date, 'booking_time', NEW.booking_time)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_new_booking
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_booking();

-- Update slot booking count
CREATE OR REPLACE FUNCTION public.update_slot_booking_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.slot_id IS NOT NULL THEN
    UPDATE public.booking_slots
    SET current_bookings = current_bookings + 1,
        is_available = CASE WHEN current_bookings + 1 >= max_bookings THEN false ELSE true END,
        updated_at = now()
    WHERE id = NEW.slot_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status != 'cancelled' AND NEW.status = 'cancelled' AND NEW.slot_id IS NOT NULL THEN
    UPDATE public.booking_slots
    SET current_bookings = GREATEST(current_bookings - 1, 0),
        is_available = true,
        updated_at = now()
    WHERE id = NEW.slot_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_slot_booking_count
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_slot_booking_count();

-- Insert default booking settings
INSERT INTO public.booking_settings (is_enabled, service_name, slot_duration_minutes)
VALUES (false, 'บริการ', 60);

-- Updated_at triggers
CREATE TRIGGER update_booking_settings_updated_at BEFORE UPDATE ON public.booking_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_booking_slots_updated_at BEFORE UPDATE ON public.booking_slots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
