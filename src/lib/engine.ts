/* eslint-disable @typescript-eslint/no-unused-vars */
export async function runInference(_inputData: unknown): Promise<unknown> {
    // Inference stub — replace with real tf.GraphModel prediction when model is available
    // Simulate inference delay
    await new Promise(resolve => setTimeout(resolve, 800));
    return {
        success: true,
        mockResult: "Mock prediction result for input"
    };
}
