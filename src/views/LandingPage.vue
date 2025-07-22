<script setup lang="ts">
import CTA from "../components/CTA.vue";
import { Button } from '@/components/ui/button';
</script>

<template>
  <article id="main">
    <h1>Figma-xr: Elevate Your Design Prototyping into the XR Realm</h1>
    <CTA></CTA>
  </article>
  <article id="description">
    <h2>What is Figma-xr?</h2>
    <p>
      Figma-xr is an open-source tool that seamlessly integrates Figma with XR,
      enabling immersive UI prototyping like never before.
    </p>
    <p>This is a POC. So features can quickly evolve based on feedback.</p>
  </article>
  <article id="features">
    <h2>Features/Benefits</h2>
    <ul>
      <li>Open Source: Built on Vite, Vue3, Typescript, Babylonjs.</li>
      <li>Seamless Integration: Figma API and Github Pages support.</li>
      <li>Immersive Prototyping: Place Figma panels anywhere.</li>
    </ul>
  </article>
  <article id="how">
    <h2>How to Use it ?</h2>
    <p>
      First, you need to connect to Figma. From which you can add your best projects. then, open one, and that's it !
    </p>

  </article>
  <footer>
    <CTA></CTA>

    <div>

      <a href="https://www.linkedin.com/in/arthur-mougin/" target="_blank" rel="noopener noreferrer">
        <Button outlined>LinkedIn</Button>
      </a>
      <a href="mailto:bonjour@arthurmoug.in" target="_blank" rel="noopener noreferrer">
        <Button outlined>Email</Button>
      </a>

    </div>
  </footer>
</template>

<style scoped></style>
