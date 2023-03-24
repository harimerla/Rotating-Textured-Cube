// We use webpack to package our shaders as string resources that we can import
//import shaderCode from "./triangle.wgsl";
//import { mat4 } from "gl-matrix";

// var shaderCode = `
// // This type definition is just to make typing a bit easier
// //type float4 = vec4<f32>;

// struct VertexInput {
//     @location(0) position: vec4<f32>,
//     @location(1) color: vec4<f32>,
// };

// struct VertexOutput {
//     // This is the equivalent of gl_Position in GLSL
//     @builtin(position) position: vec4<f32>,
//     @location(0) color: vec4<f32>,
// };

// @vertex
// fn vertex_main(vert: VertexInput) -> VertexOutput {
//     var out: VertexOutput;
//     out.color = vert.color;
//     out.position = vert.position;
//     return out;
// };

// @fragment
// fn fragment_main(in: VertexOutput) -> @location(0) vec4<f32> {
//     return vec4<f32>(in.color);
// }

// `;

var shaderCode = `
struct Uniforms {
    modelViewProjectionMatrix : mat4x4<f32>,
  }
  @binding(0) @group(0) var<uniform> uniforms : Uniforms;
  
  struct VertexOutput {
    @builtin(position) Position : vec4<f32>,
    @location(0) fragUV : vec2<f32>,
  }
  
  @vertex
  fn vertex_main(
    @location(0) position : vec4<f32>,
    @location(1) uv : vec2<f32>
  ) -> VertexOutput {
    var output : VertexOutput;
    output.Position = uniforms.modelViewProjectionMatrix * position;
    output.fragUV = uv;
    return output;
  }
  
  @group(0) @binding(1) var mySampler: sampler;
  @group(0) @binding(2) var myTexture: texture_2d<f32>;
  
  @fragment
  fn fragment_main(
    @location(0) fragUV: vec2<f32>,
  ) -> @location(0) vec4<f32> {
    //return textureSample(myTexture, mySampler, fragUV)*0.5;
    return vec4<f32>(1.,0.,0.,0.);
  }
  
`;

(async () => {
    if (navigator.gpu === undefined) {
        document.getElementById("webgpu-canvas").setAttribute("style", "display:none;");
        document.getElementById("no-webgpu").setAttribute("style", "display:block;");
        return;
    }

    // var img = document.createElement("image") as  HTMLImageElement;
    // img.src="dog.webp";
    // img.id="img";
    // function encodde(){
    //     var img = new Image();
    //     img.src = 'dog.webp';
    //     //var file = img.files[0];
    //     console.log('files'+img);
    // }
    // encodde();

    // Get a GPU device to render with
    var adapter = await navigator.gpu.requestAdapter();
    var device = await adapter.requestDevice();

    // Get a context to display our rendered image on the canvas
    var canvas = document.getElementById("webgpu-canvas") as HTMLCanvasElement;
    var context = canvas.getContext("webgpu");

    console.log(device);
    var shaderModule2 = device.createShaderModule({code: shaderCode});
    console.log(shaderModule2.getCompilationInfo);

    // Specify vertex data
    // Allocate room for the vertex data: 3 vertices, each with 2 float4's


    const data = new Float32Array([
        1, -1, 0, 1, 1, 1,
        -1, -1, 0, 1, 1, 1,
        -1, 1, 0, 1, 1, 1,
        1, 1, 0, 1, 1, 1,
        1, -1, 0, 1, 1, 1,
        -1, 1, 0, 1, 1, 1,
    ]);

  //   var data = new Float32Array([

  //     0.5,  -0.5, 0, 1,  // position
  //     1,  0,  0, 1,  // color
  //     -0.5, -0.5, 0, 1,  // position
  //     0,  1,  0, 1,  // color
  //     0.5,  0.5,  0, 1,  // position
  //     0,  0,  1, 1,  // color
  //     -0.5,  0.5, 0, 1,  // position
  //     1,  0,  0, 1,  // color
  //     -0.5, -0.5, 0, 1,  // position
  //     0,  1,  0, 1,  // color
  //     0.5,  0.5,  0, 1,  // position
  //     0,  0,  1, 1,  // color
  // ]);


    var squareDataBuf = device.createBuffer(
        {size: data.byteLength, usage: GPUBufferUsage.VERTEX, mappedAtCreation: true});
    new Float32Array(squareDataBuf.getMappedRange()).set(data);
    squareDataBuf.unmap();
    //dataBuf1.unmap();

    //Vertex attribute state and shader stage
    var vertexState = {
        // Shader stage info
        module: shaderModule2,
        entryPoint: "vertex_main",
        // Vertex buffer info
        buffers: [{
            arrayStride: 6 * 4,
            attributes: [
                {format: "float32x4", offset: 0, shaderLocation: 0},
                {format: "float32x2", offset: 4 * 4, shaderLocation: 1}
            ]
        }]
    } as GPUVertexState;

    // Setup render outputs
    var swapChainFormat = "bgra8unorm";
    context.configure(
        {device: device, format: "bgra8unorm", usage: GPUTextureUsage.RENDER_ATTACHMENT});

    var depthFormat = "depth24plus-stencil8";
    var depthTexture = device.createTexture({
        size: {width: canvas.width, height: canvas.height},
        format: "depth24plus-stencil8",
        usage: GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT
    });

    const uniformBufferSize = 4 * 16; // 4x4 matrix
    const uniformBuffer = device.createBuffer({
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM
    });

    //device.queue.writeBuffer(uniformBuffer, 0, <ArrayBuffer>mat4.create())

    // Fetch the image and upload it into a GPUTexture.
  let cubeTexture: GPUTexture;
  {
    const img = document.createElement('img');
    img.src = new URL(
      'dog.webp',
      import.meta.url
    ).toString();
    await img.decode();
    const imageBitmap = await createImageBitmap(img);
    console.log('image: '+imageBitmap.height+" "+imageBitmap.width);
    console.log('canvas'+canvas.height+" "+canvas.width);

    cubeTexture = device.createTexture({
      size: [imageBitmap.width, imageBitmap.height, 1],
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.copyExternalImageToTexture(
      { source: imageBitmap },
      { texture: cubeTexture },
      [imageBitmap.width, imageBitmap.height]
    );
  }

    //Create a sampler with linear filtering for smooth interpolation.
    const sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
    } as GPUSamplerDescriptor);

    var fragmentState = {
        // Shader info
        module: shaderModule2,
        entryPoint: "fragment_main",
        // Output render target info
        targets: [{format: swapChainFormat}]
    } as GPUFragmentState;

    // Create render pipeline
    //var uniformBindGroupLayout = device.createPipelineLayout({bindGroupLayouts: []});
    //Binding Group Layout
    var uniformBindGroupLayout = device.createBindGroupLayout({
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: {
                type: 'uniform'
            }
        } as GPUBindGroupLayoutEntry,
        {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {}
        } as unknown as GPUBindGroupLayoutEntry,
        {
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            texture: {}
        } as unknown as GPUBindGroupLayoutEntry
    ]});

    var renderPipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [uniformBindGroupLayout] }),
        //layout: 'auto',
        vertex: vertexState,
        fragment: fragmentState,
        depthStencil: {format: "depth24plus-stencil8", depthWriteEnabled: true, depthCompare: "less"},
        primitive:{topology:"triangle-list", cullMode: 'back'}
    });

    

    const uniformBindGroup = device.createBindGroup({
        //layout: renderPipeline.getBindGroupLayout(0),
        layout: uniformBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: {
              buffer: uniformBuffer,
            },
          },
          {
            binding: 1,
            resource: sampler,
          },
          {
            binding: 2,
            resource: cubeTexture.createView(),
          },
        ],
      });

    var renderPassDesc = {
        colorAttachments: [{
            view: undefined,
            loadOp: "clear",
            clearValue: [0.5, 0.5, 0.5, 1],
            storeOp: "store"
        }],
        depthStencilAttachment: {
            view: depthTexture.createView(),
            depthLoadOp: "clear",
            depthClearValue: 1.0,
            depthStoreOp: "store",
            stencilLoadOp: "clear",
            stencilClearValue: 0,
            stencilStoreOp: "store"
        }
    } as GPURenderPassDescriptor;

    var animationFrame = function() {
        var resolve = null;
        var promise = new Promise(r => resolve = r);
        window.requestAnimationFrame(resolve);
        return promise
    };
    requestAnimationFrame(animationFrame);

    // Render!
    while (true) {
        await animationFrame();

        renderPassDesc.colorAttachments[0].view = context.getCurrentTexture().createView();

        var commandEncoder = device.createCommandEncoder();

        var renderPass = commandEncoder.beginRenderPass(renderPassDesc);

        renderPass.setPipeline(renderPipeline);
        renderPass.setBindGroup(0, uniformBindGroup);
        renderPass.setVertexBuffer(0, squareDataBuf);
        renderPass.draw(6);

        renderPass.end();
        device.queue.submit([commandEncoder.finish()]);
    }
})();
