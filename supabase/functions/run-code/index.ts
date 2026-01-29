import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CodeRequest {
  code: string;
  language: 'cpp' | 'java';
}

interface CodeResponse {
  success: boolean;
  output?: string;
  error?: string;
  executionTime?: number;
}

// Piston API configuration (free, no API key needed)
const PISTON_API = 'https://emkc.org/api/v2/piston/execute';

const LANGUAGE_CONFIG: Record<string, { language: string; version: string }> = {
  cpp: { language: 'c++', version: '10.2.0' },
  java: { language: 'java', version: '15.0.2' },
};

async function executeWithPiston(code: string, language: string): Promise<CodeResponse> {
  const config = LANGUAGE_CONFIG[language];
  
  if (!config) {
    return {
      success: false,
      error: `Unsupported language: ${language}`,
    };
  }

  try {
    const startTime = Date.now();
    
    // For Java, we need to ensure the class is named Main
    let processedCode = code;
    if (language === 'java') {
      // Replace any public class name with Main for Piston compatibility
      processedCode = code.replace(/public\s+class\s+\w+/g, 'public class Main');
    }

    console.log(`Executing ${language} code with Piston API...`);

    const response = await fetch(PISTON_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: config.language,
        version: config.version,
        files: [
          {
            name: language === 'java' ? 'Main.java' : 'main.cpp',
            content: processedCode,
          },
        ],
        compile_timeout: 10000,
        run_timeout: 5000,
        compile_memory_limit: -1,
        run_memory_limit: -1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Piston API error:', errorText);
      return {
        success: false,
        error: `API error: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();
    const executionTime = Date.now() - startTime;

    console.log('Piston result:', JSON.stringify(result, null, 2));

    // Check for compile errors
    if (result.compile && result.compile.code !== 0) {
      return {
        success: false,
        error: result.compile.stderr || result.compile.output || 'Compilation failed',
        executionTime,
      };
    }

    // Check for runtime errors
    if (result.run && result.run.code !== 0) {
      const errorOutput = result.run.stderr || result.run.output || 'Runtime error';
      return {
        success: false,
        error: errorOutput,
        executionTime,
      };
    }

    // Success - return stdout
    const output = result.run?.stdout || result.run?.output || '';
    
    return {
      success: true,
      output: output || '(No output)',
      executionTime,
    };
  } catch (error: any) {
    console.error('Piston execution error:', error);
    return {
      success: false,
      error: error.message || 'Execution failed',
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, language }: CodeRequest = await req.json();

    console.log(`Received ${language} code (${code.length} chars)`);

    if (!code || !language) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing code or language' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!['cpp', 'java'].includes(language)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Only C++ and Java supported on backend' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const result = await executeWithPiston(code, language);

    console.log(`Execution complete: ${result.success ? 'success' : 'error'}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Handler error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
