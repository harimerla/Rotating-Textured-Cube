export const shaders = () => {
  const vertex = `
  struct TransformData {
    model: mat4x4<f32>,
    view: mat4x4<f32>,
    projection: mat4x4<f32>,
  };

    @binding(0) @group(0) var<uniform> transformUBO : TransformData;
    
    struct VertexOutput {
      @builtin(position) Position : vec4<f32>,
      @location(0) TexCoord : vec2<f32>,
    }
    
    @vertex
    fn main(
      @location(0) position : vec4<f32>,
      @location(1) uv : vec2<f32>
    ) -> VertexOutput {
      var output : VertexOutput;
      output.Position = transformUBO.projection * transformUBO.view * transformUBO.model * position;
      //output.Position = position;
      output.TexCoord = uv;
      return output;
    }
  `

  const fragment = `
  @group(0) @binding(1) var mySampler: sampler;
  @group(0) @binding(2) var myTexture: texture_2d<f32>;
  
  @fragment
  fn main(
    @location(0) TexCoord: vec2<f32>,
  ) -> @location(0) vec4<f32> {
    return textureSample(myTexture, mySampler, TexCoord);
  }
  `
  return {vertex, fragment}
};
