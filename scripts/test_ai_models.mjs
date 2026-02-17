#!/usr/bin/env node

/**
 * Test AI Models - Verify all installed models work correctly
 */

import { spawn } from 'node:child_process';

function runOllama(model, prompt) {
  return new Promise((resolve, reject) => {
    console.log(`\n🤖 Testing ${model}...`);
    console.log(`📝 Prompt: "${prompt.substring(0, 60)}..."`);
    
    const ollama = spawn('ollama', ['run', model, prompt]);
    let output = '';
    
    ollama.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ollama.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${model} - SUCCESS`);
        console.log(`📤 Response: ${output.substring(0, 200)}...`);
        resolve({ model, success: true, output });
      } else {
        console.log(`❌ ${model} - FAILED`);
        reject(new Error(`${model} exited with code ${code}`));
      }
    });
    
    ollama.on('error', (error) => {
      console.log(`❌ ${model} - ERROR: ${error.message}`);
      reject(error);
    });
  });
}

async function testAllModels() {
  console.log('🚀 Testing All AI Models\n');
  console.log('=' .repeat(60));
  
  const tests = [
    {
      model: 'llama3.2:3b',
      prompt: 'Analyze this video transcript and suggest what to keep: "Hello everyone, um, today we will, uh, discuss AI and machine learning. Let\'s begin with the basics."',
      name: 'Cut Planning'
    },
    {
      model: 'qwen2.5:7b',
      prompt: 'Given a tech tutorial video about AI, suggest 3 appropriate video templates with brief descriptions.',
      name: 'Template Planning'
    },
    {
      model: 'llava:7b',
      prompt: 'Describe what makes a good B-roll image for a technology video.',
      name: 'Vision Understanding'
    }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      console.log(`\n📋 Test: ${test.name}`);
      const result = await runOllama(test.model, test.prompt);
      results.push({ ...test, ...result });
    } catch (error) {
      console.error(`Failed: ${error.message}`);
      results.push({ ...test, success: false, error: error.message });
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY\n');
  
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  results.forEach((result, i) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${i + 1}. ${status} ${result.name} (${result.model})`);
  });
  
  console.log(`\n🎯 Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('\n🎉 All AI models are working correctly!');
    console.log('✅ Your local AI video editing system is ready to use!');
  } else {
    console.log('\n⚠️  Some models failed. Check the errors above.');
  }
  
  return results;
}

// Run tests
testAllModels().catch((error) => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
