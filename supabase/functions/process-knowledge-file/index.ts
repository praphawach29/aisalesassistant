import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileUrl, fileType, title, category } = await req.json();

    if (!fileUrl) {
      throw new Error('File URL is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Download file from storage
    console.log('Downloading file from:', fileUrl);
    
    // Extract bucket and path from URL
    const urlParts = fileUrl.split('/storage/v1/object/');
    let filePath = '';
    let bucketName = 'knowledge-files';
    
    if (urlParts.length > 1) {
      const pathPart = urlParts[1];
      if (pathPart.startsWith('sign/')) {
        // Signed URL format
        const signedPath = pathPart.replace('sign/', '');
        const [bucket, ...rest] = signedPath.split('/');
        bucketName = bucket;
        filePath = rest.join('/').split('?')[0];
      } else if (pathPart.startsWith('public/')) {
        const publicPath = pathPart.replace('public/', '');
        const [bucket, ...rest] = publicPath.split('/');
        bucketName = bucket;
        filePath = rest.join('/');
      }
    }

    console.log('Bucket:', bucketName, 'Path:', filePath);

    // Download the file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucketName)
      .download(filePath);

    if (downloadError) {
      console.error('Download error:', downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64Data = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // Determine MIME type
    let mimeType = 'application/pdf';
    if (fileType === 'png') mimeType = 'image/png';
    else if (fileType === 'jpg' || fileType === 'jpeg') mimeType = 'image/jpeg';
    else if (fileType === 'webp') mimeType = 'image/webp';

    console.log('Processing file with Gemini AI, type:', mimeType);

    // Call Gemini AI to read and summarize the document
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `คุณเป็นผู้เชี่ยวชาญในการอ่านและสรุปเอกสาร กรุณา:
1. อ่านเนื้อหาในเอกสาร/รูปภาพนี้อย่างละเอียด
2. ดึงข้อมูลสำคัญทั้งหมดออกมา
3. สรุปเนื้อหาให้กระชับแต่ครบถ้วน

ตอบกลับในรูปแบบ JSON:
{
  "original_content": "เนื้อหาทั้งหมดที่อ่านได้จากเอกสาร (ถอดความแบบละเอียด)",
  "summary": "สรุปเนื้อหาสำคัญ (3-5 ประโยค)"
}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'กรุณาอ่านและสรุปเนื้อหาในไฟล์นี้'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Data}`
                }
              }
            ]
          }
        ],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded, please try again later');
      }
      if (response.status === 402) {
        throw new Error('Payment required, please add credits');
      }
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResult = await response.json();
    const aiContent = aiResult.choices?.[0]?.message?.content || '';
    
    console.log('AI Response:', aiContent);

    // Parse the JSON response
    let originalContent = '';
    let summary = '';

    try {
      // Try to extract JSON from the response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        originalContent = parsed.original_content || '';
        summary = parsed.summary || '';
      }
    } catch (parseError) {
      console.log('Failed to parse JSON, using raw content');
      originalContent = aiContent;
      summary = aiContent.substring(0, 500);
    }

    // Save to database
    const { data: insertData, error: insertError } = await supabase
      .from('knowledge_base')
      .insert({
        title: title || 'Untitled Document',
        file_url: fileUrl,
        file_type: fileType || 'pdf',
        original_content: originalContent,
        summary: summary,
        category: category || null,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error(`Failed to save: ${insertError.message}`);
    }

    console.log('Successfully processed and saved document:', insertData.id);

    return new Response(JSON.stringify({
      success: true,
      data: insertData,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing knowledge file:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
