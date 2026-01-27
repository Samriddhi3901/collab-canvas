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

// Use JDoodle API for C++ and Java execution
const JDOODLE_CLIENT_ID = Deno.env.get('JDOODLE_CLIENT_ID');
const JDOODLE_CLIENT_SECRET = Deno.env.get('JDOODLE_CLIENT_SECRET');

const LANGUAGE_CONFIG: Record<string, { language: string; versionIndex: string }> = {
  cpp: { language: 'cpp17', versionIndex: '0' },
  java: { language: 'java', versionIndex: '4' },
};

async function executeWithJDoodle(code: string, language: string): Promise<CodeResponse> {
  const config = LANGUAGE_CONFIG[language];
  
  if (!JDOODLE_CLIENT_ID || !JDOODLE_CLIENT_SECRET) {
    // If no JDoodle credentials, use a simple mock for demo
    return {
      success: true,
      output: `[Mock Output] ${language.toUpperCase()} code received (${code.length} chars)\n\nTo enable real ${language.toUpperCase()} execution:\n1. Get free API credentials from jdoodle.com\n2. Add JDOODLE_CLIENT_ID and JDOODLE_CLIENT_SECRET secrets`,
      executionTime: 0,
    };
  }

  try {
    const startTime = Date.now();
    
    const response = await fetch('https://api.jdoodle.com/v1/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: JDOODLE_CLIENT_ID,
        clientSecret: JDOODLE_CLIENT_SECRET,
        script: code,
        language: config.language,
        versionIndex: config.versionIndex,
      }),
    });

    const result = await response.json();
    const executionTime = Date.now() - startTime;

    if (result.error) {
      return {
        success: false,
        error: result.error,
        executionTime,
      };
    }

    return {
      success: true,
      output: result.output || '',
      executionTime,
    };
  } catch (error: any) {
    console.error('JDoodle execution error:', error);
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

    console.log(`Executing ${language} code (${code.length} chars)`);

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

    const result = await executeWithJDoodle(code, language);

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
