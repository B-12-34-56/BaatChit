  } catch (error) {
    console.error('❌ [checkDuplicate] Lambda error:', error);
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        success: false,
        blocked: false,
        totalCount: 0,
        uploadCount: 0,
        imageUrl: null,
        perceptualHash: null,
        similarImages: [],
        message: `Error: ${error.message || 'Unknown error occurred'}`
      })
    };
  } 