-- process_fee_batch.sql

-- RPC to process an entire fee batch atomically
CREATE OR REPLACE FUNCTION process_fee_batch(p_batch_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch RECORD;
  v_entry RECORD;
  v_invoice RECORD;
  
  v_remaining_amount NUMERIC;
  v_allocated_amount NUMERIC;
  v_success_count INTEGER := 0;
  v_failed_count INTEGER := 0;
  v_advance_total NUMERIC := 0;
  v_duplicate_count INTEGER := 0;
  
  v_total_successful_amount NUMERIC := 0;
BEGIN
  -- 1. Fetch and Lock the Batch
  SELECT * INTO v_batch FROM public.fee_batches WHERE id = p_batch_id FOR UPDATE;
  
  IF v_batch.id IS NULL THEN
    RAISE EXCEPTION 'Batch not found';
  END IF;
  
  IF v_batch.status != 'draft' THEN
    RAISE EXCEPTION 'Only draft batches can be processed';
  END IF;

  -- 2. Iterate through each pending entry in the batch
  FOR v_entry IN 
    SELECT * FROM public.fee_batch_entries 
    WHERE batch_id = p_batch_id AND status = 'pending'
    ORDER BY entry_number ASC
  LOOP
    BEGIN
      -- Validate Student
      IF v_entry.student_id IS NULL THEN
        RAISE EXCEPTION 'Invalid student ID';
      END IF;
      
      -- Check Duplicate UTR/Slip in existing fee_payments (outside this batch)
      IF v_entry.slip_number IS NOT NULL AND v_entry.slip_number != '' THEN
        IF EXISTS (SELECT 1 FROM public.fee_payments WHERE transaction_id = v_entry.slip_number) THEN
          v_duplicate_count := v_duplicate_count + 1;
          RAISE EXCEPTION 'Duplicate slip/UTR number detected';
        END IF;
      END IF;

      -- Process Payment Allocation (FIFO)
      v_remaining_amount := v_entry.amount_paid;
      
      -- Fetch outstanding invoices for the student (oldest first)
      FOR v_invoice IN 
        SELECT * FROM public.fee_demands 
        WHERE student_id = v_entry.student_id AND status IN ('pending', 'partial')
        ORDER BY due_date ASC
        FOR UPDATE
      LOOP
        IF v_remaining_amount <= 0 THEN
          EXIT;
        END IF;
        
        v_allocated_amount := LEAST(v_remaining_amount, v_invoice.total_amount - v_invoice.paid_amount);
        
        IF v_allocated_amount > 0 THEN
          -- Create Payment Record
          INSERT INTO public.fee_payments (
            student_id, demand_id, amount, payment_date, payment_method, transaction_id, status, recorded_by
          ) VALUES (
            v_entry.student_id, v_invoice.id, v_allocated_amount, v_batch.deposit_date, v_entry.payment_mode, v_entry.slip_number, 'success', p_user_id
          );
          
          -- Update Demand Record
          UPDATE public.fee_demands 
          SET paid_amount = paid_amount + v_allocated_amount,
              status = CASE 
                         WHEN paid_amount + v_allocated_amount >= total_amount THEN 'paid'::fee_demand_status 
                         ELSE 'partial'::fee_demand_status 
                       END,
              updated_at = NOW()
          WHERE id = v_invoice.id;
          
          v_remaining_amount := v_remaining_amount - v_allocated_amount;
        END IF;
      END LOOP;
      
      -- Handle excess amount as Advance (if any)
      IF v_remaining_amount > 0 THEN
        -- In a full system, you would insert into an 'advances' ledger.
        -- For now, we log it in the batch totals.
        v_advance_total := v_advance_total + v_remaining_amount;
      END IF;
      
      -- Mark Entry as Success
      UPDATE public.fee_batch_entries 
      SET status = 'success', 
          processing_timestamp = NOW(),
          balance_after_posting = v_remaining_amount -- Unallocated/Advance
      WHERE id = v_entry.id;
      
      v_success_count := v_success_count + 1;
      v_total_successful_amount := v_total_successful_amount + v_entry.amount_paid;

    EXCEPTION WHEN OTHERS THEN
      -- Mark Entry as Failed
      UPDATE public.fee_batch_entries 
      SET status = 'failed', 
          validation_message = SQLERRM,
          processing_timestamp = NOW()
      WHERE id = v_entry.id;
      
      v_failed_count := v_failed_count + 1;
      
      -- We do NOT commit partial batches. 
      -- Requirement: "If any unrecoverable error occurs, the transaction should roll back completely"
      RAISE EXCEPTION 'Batch Processing Failed on Entry #%: %', v_entry.entry_number, SQLERRM;
    END;
  END LOOP;
  
  -- 3. Final Batch Validation
  -- Optional: Verify that total successful amount matches the declared total amount
  -- (Usually enforced on the frontend before calling RPC, but good to double check)
  
  -- 4. Mark Batch as Processed
  UPDATE public.fee_batches 
  SET status = 'processed',
      processed_by = p_user_id,
      processed_at = NOW(),
      total_successful_entries = v_success_count,
      total_failed_entries = v_failed_count,
      total_advance_payments = v_advance_total,
      total_duplicate_entries = v_duplicate_count
  WHERE id = p_batch_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'processed_count', v_success_count,
    'advance_total', v_advance_total
  );

END;
$$;
