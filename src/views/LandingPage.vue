<script setup lang="ts">
import CTA from "../components/CTA.vue";
</script>

<template>
  <article id="main" class="h-screen bg-foreground flex flex-col justify-center items-start pl-10">
    <h3 class="text-primary-foreground font-serif text-4xl font-medium">Elevate Your Design Prototyping into the XR
      Realm</h3>
    <CTA></CTA>
  </article>
  <article id="description" class="h-screen flex flex-col justify-center items-start space-y-4 pl-10">
    <h2 class="font-serif text-2xl font-medium">What is Figma-xr?</h2>
    <p>
      Figma-xr is an open-source tool that seamlessly integrates Figma with XR,
      enabling immersive UI prototyping like never before.
    </p>
    <p>As it is a <span class="font-bold">POC</span>, features can quickly evolve based on feedback.</p>
  </article>
  <article id="features"
    class="h-screen  flex flex-col justify-center items-start space-y-4 pl-10  bg-foreground text-primary-foreground">
    <h2 class="font-serif text-2xl font-medium">Features/Benefits</h2>
    <ul>
      <li><span class="font-bold">Open Source:</span> Built on Vite, Vue3, Typescript, Babylonjs</li>
      <li><span class="font-bold">Seamless Integration:</span> Figma API and Github Pages support</li>
      <li><span class="font-bold">Immersive Prototyping:</span> Place Figma panels anywhere</li>
    </ul>
  </article>
  <article id="how" class="h-screen  flex flex-col justify-center items-start space-y-4 pl-10">
    <h2 class="font-serif text-2xl font-medium">How to Use it ?</h2>
    <p>
      First, you connect to your Figma account. From which you can add your best projects. Open one, and that's it !
    </p>
  </article>
  <footer class="bg-foreground">
    <CTA></CTA>
    <p class="text-center text-primary-foreground">Made with ❤️ by Arthur Mougin</p>
  </footer>
</template>

<style scoped></style>
