import {vec3,mat4} from 'gl-matrix'
import { CubeData } from './cubeData'
import {shaders} from './triangle'

(async() => {
  var adapter = await navigator.gpu.requestAdapter();
  var device = await adapter.requestDevice();

  var canvas = document.getElementById("webgpu-canvas") as HTMLCanvasElement;
  var context = canvas.getContext("webgpu");
  
  var cube = CubeData(1,1).cube;
  var cubeBuff = device.createBuffer({
    size: cube.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true 
  });

  new Float32Array(cubeBuff.getMappedRange()).set(cube);
  cubeBuff.unmap();

  var uniformBuffer = device.createBuffer({
    size: 3*4*16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  var uniformBuffer1 = device.createBuffer({
    size: 3*4*16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(uniformBuffer, 0, <ArrayBuffer>mat4.create());
  device.queue.writeBuffer(uniformBuffer, 4*16, <ArrayBuffer>mat4.create())
  device.queue.writeBuffer(uniformBuffer, 4*2*16, <ArrayBuffer>mat4.create())

  device.queue.writeBuffer(uniformBuffer1, 0, <ArrayBuffer>mat4.create());
  device.queue.writeBuffer(uniformBuffer1, 4*16, <ArrayBuffer>mat4.create())
  device.queue.writeBuffer(uniformBuffer1, 4*2*16, <ArrayBuffer>mat4.create())

  var sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
    mipmapFilter: 'nearest',
    maxAnisotropy: 1
  } as GPUSamplerDescriptor);
  var depthTexture = device.createTexture({
    size: {width: canvas.width, height: canvas.height},
    format: "depth24plus-stencil8",
    usage: GPUTextureUsage.TEXTURE_BINDING |
    GPUTextureUsage.COPY_DST |
    GPUTextureUsage.RENDER_ATTACHMENT
  });

  let cubeTexture: GPUTexture;
  {
    const img = document.createElement('img');
    const response: Response = await fetch('dog.webp');
    const blob: Blob = await response.blob();
    const imageBitmap = await createImageBitmap(blob);

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

  var bindingGroupLayout = device.createBindGroupLayout({
    entries:[{
      binding: 0,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer:{type:'uniform'}
    } as GPUBindGroupLayoutEntry,{
      binding: 1,
      visibility: GPUShaderStage.FRAGMENT,
      sampler: {}
    } as GPUBindGroupLayoutEntry,{
      binding: 2,
      visibility: GPUShaderStage.FRAGMENT,
      texture:{}
    } as GPUBindGroupLayoutEntry]
  });

  var uniformBindGroup = device.createBindGroup({
    layout: bindingGroupLayout,
    entries: [
      {
        binding: 0,
        resource: {buffer: uniformBuffer}
      },
      {
        binding: 1,
        resource: sampler
      },
      {
        binding: 2,
        resource: cubeTexture.createView()
      }
    ]
  });

  var uniformBindGroup2 = device.createBindGroup({
    layout: bindingGroupLayout,
    entries: [
      {
        binding: 0,
        resource: {buffer: uniformBuffer1}
      },
      {
        binding: 1,
        resource: sampler
      },
      {
        binding: 2,
        resource: cubeTexture.createView()
      }
    ]
  });

  context.configure(
    {device: device, format: "bgra8unorm", usage: GPUTextureUsage.RENDER_ATTACHMENT});

  var renderPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({bindGroupLayouts: [bindingGroupLayout]}),
    vertex: {
      module: device.createShaderModule({code: shaders().vertex}),
      entryPoint: 'main',
      buffers: [{
        arrayStride: 6*4,
        attributes:[
          {format: 'float32x4', offset:0, shaderLocation: 0},
          {format: 'float32x2', offset:16, shaderLocation: 1}]
      }]
    } as GPUVertexState,
    fragment:{
      module: device.createShaderModule({code: shaders().fragment}),
      entryPoint: 'main',
      targets: [{format: 'bgra8unorm'}]
    } as GPUFragmentState,
    depthStencil: {format: "depth24plus-stencil8", depthWriteEnabled: true, depthCompare: "less"},
    primitive:{topology:"triangle-list"},
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
const aspect = canvas.width / canvas.height;
  const projectionMatrix = mat4.create();
  mat4.perspective(projectionMatrix, (2 * Math.PI) / 5, aspect, 1, 100.0);

  function getTransformationMatrix(xAxis=0, yAxis=0, rotRev=false) {
    const viewMatrix = mat4.create();
    const now = Date.now() / 1000;
    mat4.translate(viewMatrix, viewMatrix, vec3.fromValues(xAxis, yAxis, -4));
    //mat4.lookAt(viewMatrix, vec3.fromValues(-5,5,5), vec3.fromValues(0,0,0), vec3.fromValues(1,1,0));

    var rotateVector;
    if(rotRev)
      rotateVector=vec3.fromValues(Math.sin(now)%36, Math.cos(now)%36, 0);
    else
      rotateVector=vec3.fromValues(Math.cos(now)%36, Math.sin(now)%36, 0);
    mat4.rotate(
      viewMatrix,
      viewMatrix,
      1,
      //vec3.fromValues(0, 0, 0)
      rotateVector
      //vec3.fromValues(now*now%36, now*now%36, 0)
    );
    //console.log('mhgcjhfc'+vec3.fromValues(0, 0, -4));
    const modelViewProjectionMatrix = mat4.create();
    mat4.multiply(modelViewProjectionMatrix, projectionMatrix, viewMatrix);

    return modelViewProjectionMatrix as Float32Array;
  }

while(true){
  await animationFrame();

  const transformationMatrix = getTransformationMatrix(0,0);
    device.queue.writeBuffer(
      uniformBuffer,
      0,
      transformationMatrix.buffer,
      transformationMatrix.byteOffset,
      transformationMatrix.byteLength
    );

  renderPassDesc.colorAttachments[0].view = context.getCurrentTexture().createView();
  var commandEncoder = device.createCommandEncoder();
  var renderPass = commandEncoder.beginRenderPass(renderPassDesc);

  renderPass.setPipeline(renderPipeline);
  renderPass.setVertexBuffer(0,cubeBuff);
  renderPass.setBindGroup(0,uniformBindGroup);
  renderPass.draw(36);

  // const transformationMatrix1 = getTransformationMatrix(3,0,true);
  //   device.queue.writeBuffer(
  //     uniformBuffer1,
  //     0,
  //     transformationMatrix1.buffer,
  //     transformationMatrix1.byteOffset,
  //     transformationMatrix1.byteLength
  //   );

  // renderPass.setBindGroup(0,uniformBindGroup2);
  // renderPass.draw(36);

  renderPass.end();
  device.queue.submit([commandEncoder.finish()]);
}

})();