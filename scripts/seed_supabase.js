const { createClient } = require('@supabase/supabase-js');
const questions = require('../backend/data/questions.js');

const SUPABASE_URL = 'https://taszwfsiiqeodlbaqmfj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhc3p3ZnNpaXFlb2RsYmFxbWZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMjAwNDgsImV4cCI6MjEwMjY5NjA0OH0.T9b6ME60WGUQx6QDHJmDa8PSzK7QQ5HlxkIOVZI7Agc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function seed() {
  console.log(`Starting to seed ${questions.length} questions to Supabase...`);

  // Transform data for Supabase questions table
  const formatted = questions.map((q) => ({
    class: q.class,
    subject: q.subject,
    difficulty: q.difficulty || 1,
    packet: q.packet || 1,
    question: q.question,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation || '',
  }));

  // Batch insert 100 at a time
  const BATCH_SIZE = 100;
  for (let i = 0; i < formatted.length; i += BATCH_SIZE) {
    const batch = formatted.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase.from('questions').insert(batch);
    if (error) {
      console.error(`Error inserting batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
    } else {
      console.log(`Successfully inserted batch ${Math.floor(i / BATCH_SIZE) + 1} (${Math.min(i + batch.length, formatted.length)}/${formatted.length})`);
    }
  }

  console.log('Seeding completed successfully!');
}

seed();
