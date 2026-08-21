//! Minimal, complete Vulkan 1.1 compute back end built directly on `ash`.
//!
//! Everything the renderer needs and nothing it does not: one compute queue,
//! host-visible storage buffers (persistently mapped, so no staging copies),
//! one descriptor set, two compute pipelines (render + probe) created from a
//! single SPIR-V module, and synchronous submit/wait with an explicit
//! shader-write -> host-read barrier.

use ash::vk;
use std::ffi::{c_char, CStr};

pub struct Buffer {
    pub handle: vk::Buffer,
    pub mem: vk::DeviceMemory,
    pub size: u64,
    pub ptr: *mut u8,
}

impl Buffer {
    /// # Safety
    /// The caller guarantees the buffer is not concurrently written by the GPU.
    pub unsafe fn as_slice<T: Copy>(&self) -> &[T] {
        std::slice::from_raw_parts(self.ptr as *const T, self.size as usize / size_of::<T>())
    }
    pub fn zero(&self) {
        unsafe { std::ptr::write_bytes(self.ptr, 0u8, self.size as usize) };
    }
    pub fn write_bytes(&self, bytes: &[u8]) {
        assert!(bytes.len() as u64 <= self.size);
        unsafe { std::ptr::copy_nonoverlapping(bytes.as_ptr(), self.ptr, bytes.len()) };
    }
}

pub struct DeviceInfo {
    pub name: String,
    pub api: (u32, u32, u32),
    pub kind: &'static str,
    pub max_wg: [u32; 3],
    pub max_alloc_mb: u64,
}

pub struct Gpu {
    _entry: ash::Entry,
    instance: ash::Instance,
    pub device: ash::Device,
    pub queue: vk::Queue,
    pub pool: vk::CommandPool,
    pub cb: vk::CommandBuffer,
    pub fence: vk::Fence,
    pub info: DeviceInfo,
    mem_props: vk::PhysicalDeviceMemoryProperties,
}

fn ver(v: u32) -> (u32, u32, u32) {
    (
        vk::api_version_major(v),
        vk::api_version_minor(v),
        vk::api_version_patch(v),
    )
}

fn dev_kind(t: vk::PhysicalDeviceType) -> &'static str {
    match t {
        vk::PhysicalDeviceType::DISCRETE_GPU => "discrete GPU",
        vk::PhysicalDeviceType::INTEGRATED_GPU => "integrated GPU",
        vk::PhysicalDeviceType::VIRTUAL_GPU => "virtual GPU",
        vk::PhysicalDeviceType::CPU => "software",
        _ => "other",
    }
}

fn cstr_to_string(raw: &[c_char]) -> String {
    unsafe { CStr::from_ptr(raw.as_ptr()) }
        .to_string_lossy()
        .into_owned()
}

impl Gpu {
    /// Enumerate every Vulkan device without creating a logical device.
    pub fn list() -> Result<Vec<String>, String> {
        unsafe {
            let entry = ash::Entry::load().map_err(|e| format!("no Vulkan loader: {e}"))?;
            let app = vk::ApplicationInfo::default()
                .application_name(CStr::from_bytes_with_nul(b"ice_cave_rt\0").unwrap())
                .api_version(vk::make_api_version(0, 1, 1, 0));
            let ci = vk::InstanceCreateInfo::default().application_info(&app);
            let instance = entry
                .create_instance(&ci, None)
                .map_err(|e| format!("vkCreateInstance failed: {e}"))?;
            let pdevs = instance
                .enumerate_physical_devices()
                .map_err(|e| format!("enumerate_physical_devices: {e}"))?;
            let mut out = Vec::new();
            for (i, p) in pdevs.iter().enumerate() {
                let pr = instance.get_physical_device_properties(*p);
                let v = ver(pr.api_version);
                out.push(format!(
                    "[{i}] {} ({}, Vulkan {}.{}.{})",
                    cstr_to_string(&pr.device_name),
                    dev_kind(pr.device_type),
                    v.0,
                    v.1,
                    v.2
                ));
            }
            instance.destroy_instance(None);
            Ok(out)
        }
    }

    pub fn new(prefer: Option<usize>) -> Result<Self, String> {
        unsafe {
            let entry = ash::Entry::load().map_err(|e| format!("no Vulkan loader: {e}"))?;
            let app = vk::ApplicationInfo::default()
                .application_name(CStr::from_bytes_with_nul(b"ice_cave_rt\0").unwrap())
                .api_version(vk::make_api_version(0, 1, 1, 0));
            let ci = vk::InstanceCreateInfo::default().application_info(&app);
            let instance = entry
                .create_instance(&ci, None)
                .map_err(|e| format!("vkCreateInstance failed: {e}"))?;

            let pdevs = instance
                .enumerate_physical_devices()
                .map_err(|e| format!("enumerate_physical_devices: {e}"))?;
            if pdevs.is_empty() {
                instance.destroy_instance(None);
                return Err("no Vulkan physical device found".into());
            }

            // score: explicit choice > discrete > integrated > anything, and the
            // device must expose a compute-capable queue family
            let mut best: Option<(usize, u32, i32)> = None;
            for (i, p) in pdevs.iter().enumerate() {
                let props = instance.get_physical_device_properties(*p);
                let qs = instance.get_physical_device_queue_family_properties(*p);
                let qf = qs.iter().position(|q| {
                    q.queue_flags.contains(vk::QueueFlags::COMPUTE) && q.queue_count > 0
                });
                let Some(qf) = qf else { continue };
                let mut score = match props.device_type {
                    vk::PhysicalDeviceType::DISCRETE_GPU => 100,
                    vk::PhysicalDeviceType::INTEGRATED_GPU => 60,
                    vk::PhysicalDeviceType::VIRTUAL_GPU => 30,
                    _ => 10,
                };
                if prefer == Some(i) {
                    score = 1000;
                }
                if best.map(|b| score > b.2).unwrap_or(true) {
                    best = Some((i, qf as u32, score));
                }
            }
            let Some((pi, qfam, _)) = best else {
                instance.destroy_instance(None);
                return Err("no device with a compute queue".into());
            };
            let pdev = pdevs[pi];
            let props = instance.get_physical_device_properties(pdev);
            let mem_props = instance.get_physical_device_memory_properties(pdev);
            let mut max_alloc_mb = 0u64;
            for h in 0..mem_props.memory_heap_count as usize {
                let hp = mem_props.memory_heaps[h];
                if hp.flags.contains(vk::MemoryHeapFlags::DEVICE_LOCAL) {
                    max_alloc_mb = max_alloc_mb.max(hp.size / (1024 * 1024));
                }
            }
            let info = DeviceInfo {
                name: cstr_to_string(&props.device_name),
                api: ver(props.api_version),
                kind: dev_kind(props.device_type),
                max_wg: props.limits.max_compute_work_group_count,
                max_alloc_mb,
            };

            let prio = [1.0f32];
            let qci = [vk::DeviceQueueCreateInfo::default()
                .queue_family_index(qfam)
                .queue_priorities(&prio)];
            let dci = vk::DeviceCreateInfo::default().queue_create_infos(&qci);
            let device = instance
                .create_device(pdev, &dci, None)
                .map_err(|e| format!("vkCreateDevice failed: {e}"))?;
            let queue = device.get_device_queue(qfam, 0);

            let pool = device
                .create_command_pool(
                    &vk::CommandPoolCreateInfo::default()
                        .queue_family_index(qfam)
                        .flags(vk::CommandPoolCreateFlags::RESET_COMMAND_BUFFER),
                    None,
                )
                .map_err(|e| format!("create_command_pool: {e}"))?;
            let cbs = device
                .allocate_command_buffers(
                    &vk::CommandBufferAllocateInfo::default()
                        .command_pool(pool)
                        .level(vk::CommandBufferLevel::PRIMARY)
                        .command_buffer_count(1),
                )
                .map_err(|e| format!("allocate_command_buffers: {e}"))?;
            let fence = device
                .create_fence(&vk::FenceCreateInfo::default(), None)
                .map_err(|e| format!("create_fence: {e}"))?;

            Ok(Gpu {
                _entry: entry,
                instance,
                device,
                queue,
                pool,
                cb: cbs[0],
                fence,
                info,
                mem_props,
            })
        }
    }

    fn mem_type(&self, req: &vk::MemoryRequirements) -> Result<u32, String> {
        // Prefer DEVICE_LOCAL *and* HOST_VISIBLE (integrated GPUs / ReBAR): the
        // renderer then needs no staging buffers at all.
        let want_fast = vk::MemoryPropertyFlags::DEVICE_LOCAL
            | vk::MemoryPropertyFlags::HOST_VISIBLE
            | vk::MemoryPropertyFlags::HOST_COHERENT;
        let want_any =
            vk::MemoryPropertyFlags::HOST_VISIBLE | vk::MemoryPropertyFlags::HOST_COHERENT;
        for want in [want_fast, want_any] {
            for i in 0..self.mem_props.memory_type_count {
                let bit = 1u32 << i;
                if req.memory_type_bits & bit == 0 {
                    continue;
                }
                if self.mem_props.memory_types[i as usize]
                    .property_flags
                    .contains(want)
                {
                    return Ok(i);
                }
            }
        }
        Err("no host-visible coherent memory type for this buffer".into())
    }

    pub fn create_buffer(&self, size: u64, usage: vk::BufferUsageFlags) -> Result<Buffer, String> {
        unsafe {
            let handle = self
                .device
                .create_buffer(
                    &vk::BufferCreateInfo::default()
                        .size(size)
                        .usage(usage)
                        .sharing_mode(vk::SharingMode::EXCLUSIVE),
                    None,
                )
                .map_err(|e| format!("create_buffer({size}): {e}"))?;
            let req = self.device.get_buffer_memory_requirements(handle);
            let idx = self.mem_type(&req)?;
            let mem = self
                .device
                .allocate_memory(
                    &vk::MemoryAllocateInfo::default()
                        .allocation_size(req.size)
                        .memory_type_index(idx),
                    None,
                )
                .map_err(|e| format!("allocate_memory({}): {e}", req.size))?;
            self.device
                .bind_buffer_memory(handle, mem, 0)
                .map_err(|e| format!("bind_buffer_memory: {e}"))?;
            let ptr = self
                .device
                .map_memory(mem, 0, req.size, vk::MemoryMapFlags::empty())
                .map_err(|e| format!("map_memory: {e}"))? as *mut u8;
            Ok(Buffer {
                handle,
                mem,
                size,
                ptr,
            })
        }
    }

    pub fn destroy_buffer(&self, b: &Buffer) {
        unsafe {
            self.device.unmap_memory(b.mem);
            self.device.destroy_buffer(b.handle, None);
            self.device.free_memory(b.mem, None);
        }
    }

    /// Record + submit + wait. `f` records the work into the reusable buffer.
    pub fn submit_sync<F: FnOnce(vk::CommandBuffer)>(&self, f: F) -> Result<(), String> {
        unsafe {
            self.device
                .reset_command_buffer(self.cb, vk::CommandBufferResetFlags::empty())
                .map_err(|e| format!("reset_command_buffer: {e}"))?;
            self.device
                .begin_command_buffer(
                    self.cb,
                    &vk::CommandBufferBeginInfo::default()
                        .flags(vk::CommandBufferUsageFlags::ONE_TIME_SUBMIT),
                )
                .map_err(|e| format!("begin_command_buffer: {e}"))?;
            f(self.cb);
            // make shader writes visible to the host and to the next dispatch
            let mb = [vk::MemoryBarrier::default()
                .src_access_mask(vk::AccessFlags::SHADER_WRITE)
                .dst_access_mask(
                    vk::AccessFlags::SHADER_READ
                        | vk::AccessFlags::SHADER_WRITE
                        | vk::AccessFlags::HOST_READ,
                )];
            self.device.cmd_pipeline_barrier(
                self.cb,
                vk::PipelineStageFlags::COMPUTE_SHADER,
                vk::PipelineStageFlags::COMPUTE_SHADER | vk::PipelineStageFlags::HOST,
                vk::DependencyFlags::empty(),
                &mb,
                &[],
                &[],
            );
            self.device
                .end_command_buffer(self.cb)
                .map_err(|e| format!("end_command_buffer: {e}"))?;
            let cbs = [self.cb];
            let si = [vk::SubmitInfo::default().command_buffers(&cbs)];
            self.device
                .reset_fences(&[self.fence])
                .map_err(|e| format!("reset_fences: {e}"))?;
            self.device
                .queue_submit(self.queue, &si, self.fence)
                .map_err(|e| format!("queue_submit: {e}"))?;
            self.device
                .wait_for_fences(&[self.fence], true, 60_000_000_000)
                .map_err(|e| format!("wait_for_fences (GPU hang or TDR?): {e}"))?;
            Ok(())
        }
    }
}

impl Drop for Gpu {
    fn drop(&mut self) {
        unsafe {
            let _ = self.device.device_wait_idle();
            self.device.destroy_fence(self.fence, None);
            self.device.destroy_command_pool(self.pool, None);
            self.device.destroy_device(None);
            self.instance.destroy_instance(None);
        }
    }
}

// ---------------------------------------------------------------------------
//  Pipelines + descriptors for the path tracer
// ---------------------------------------------------------------------------

pub struct Kernel {
    pub module: vk::ShaderModule,
    pub dsl: vk::DescriptorSetLayout,
    pub layout: vk::PipelineLayout,
    pub pool: vk::DescriptorPool,
    pub set: vk::DescriptorSet,
    pub render: vk::Pipeline,
    pub probe: vk::Pipeline,
}

impl Kernel {
    pub fn new(
        gpu: &Gpu,
        spirv: &[u32],
        params: &Buffer,
        accum: &Buffer,
        aov: &Buffer,
        probe_buf: &Buffer,
        push_size: u32,
    ) -> Result<Self, String> {
        unsafe {
            let d = &gpu.device;
            let module = d
                .create_shader_module(&vk::ShaderModuleCreateInfo::default().code(spirv), None)
                .map_err(|e| format!("create_shader_module: {e}"))?;

            let b = |i: u32, t: vk::DescriptorType| {
                vk::DescriptorSetLayoutBinding::default()
                    .binding(i)
                    .descriptor_type(t)
                    .descriptor_count(1)
                    .stage_flags(vk::ShaderStageFlags::COMPUTE)
            };
            let bindings = [
                b(0, vk::DescriptorType::UNIFORM_BUFFER),
                b(1, vk::DescriptorType::STORAGE_BUFFER),
                b(2, vk::DescriptorType::STORAGE_BUFFER),
                b(3, vk::DescriptorType::STORAGE_BUFFER),
            ];
            let dsl = d
                .create_descriptor_set_layout(
                    &vk::DescriptorSetLayoutCreateInfo::default().bindings(&bindings),
                    None,
                )
                .map_err(|e| format!("create_descriptor_set_layout: {e}"))?;

            let ranges = [vk::PushConstantRange::default()
                .stage_flags(vk::ShaderStageFlags::COMPUTE)
                .offset(0)
                .size(push_size)];
            let dsls = [dsl];
            let layout = d
                .create_pipeline_layout(
                    &vk::PipelineLayoutCreateInfo::default()
                        .set_layouts(&dsls)
                        .push_constant_ranges(&ranges),
                    None,
                )
                .map_err(|e| format!("create_pipeline_layout: {e}"))?;

            let sizes = [
                vk::DescriptorPoolSize::default()
                    .ty(vk::DescriptorType::UNIFORM_BUFFER)
                    .descriptor_count(1),
                vk::DescriptorPoolSize::default()
                    .ty(vk::DescriptorType::STORAGE_BUFFER)
                    .descriptor_count(3),
            ];
            let pool = d
                .create_descriptor_pool(
                    &vk::DescriptorPoolCreateInfo::default()
                        .max_sets(1)
                        .pool_sizes(&sizes),
                    None,
                )
                .map_err(|e| format!("create_descriptor_pool: {e}"))?;
            let set = d
                .allocate_descriptor_sets(
                    &vk::DescriptorSetAllocateInfo::default()
                        .descriptor_pool(pool)
                        .set_layouts(&dsls),
                )
                .map_err(|e| format!("allocate_descriptor_sets: {e}"))?[0];

            let bi = |buf: &Buffer| {
                [vk::DescriptorBufferInfo::default()
                    .buffer(buf.handle)
                    .offset(0)
                    .range(buf.size)]
            };
            let i0 = bi(params);
            let i1 = bi(accum);
            let i2 = bi(aov);
            let i3 = bi(probe_buf);
            let writes = [
                vk::WriteDescriptorSet::default()
                    .dst_set(set)
                    .dst_binding(0)
                    .descriptor_type(vk::DescriptorType::UNIFORM_BUFFER)
                    .buffer_info(&i0),
                vk::WriteDescriptorSet::default()
                    .dst_set(set)
                    .dst_binding(1)
                    .descriptor_type(vk::DescriptorType::STORAGE_BUFFER)
                    .buffer_info(&i1),
                vk::WriteDescriptorSet::default()
                    .dst_set(set)
                    .dst_binding(2)
                    .descriptor_type(vk::DescriptorType::STORAGE_BUFFER)
                    .buffer_info(&i2),
                vk::WriteDescriptorSet::default()
                    .dst_set(set)
                    .dst_binding(3)
                    .descriptor_type(vk::DescriptorType::STORAGE_BUFFER)
                    .buffer_info(&i3),
            ];
            d.update_descriptor_sets(&writes, &[]);

            let mk = |entry: &CStr| -> Result<vk::Pipeline, String> {
                let stage = vk::PipelineShaderStageCreateInfo::default()
                    .stage(vk::ShaderStageFlags::COMPUTE)
                    .module(module)
                    .name(entry);
                let ci = [vk::ComputePipelineCreateInfo::default()
                    .stage(stage)
                    .layout(layout)];
                d.create_compute_pipelines(vk::PipelineCache::null(), &ci, None)
                    .map(|v| v[0])
                    .map_err(|(_, e)| format!("create_compute_pipelines({entry:?}): {e}"))
            };
            let render = mk(CStr::from_bytes_with_nul(b"cs_render\0").unwrap())?;
            let probe = mk(CStr::from_bytes_with_nul(b"cs_probe\0").unwrap())?;

            Ok(Kernel {
                module,
                dsl,
                layout,
                pool,
                set,
                render,
                probe,
            })
        }
    }

    pub fn destroy(&self, gpu: &Gpu) {
        unsafe {
            let d = &gpu.device;
            d.destroy_pipeline(self.render, None);
            d.destroy_pipeline(self.probe, None);
            d.destroy_pipeline_layout(self.layout, None);
            d.destroy_descriptor_pool(self.pool, None);
            d.destroy_descriptor_set_layout(self.dsl, None);
            d.destroy_shader_module(self.module, None);
        }
    }
}
