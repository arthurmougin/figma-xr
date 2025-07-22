<script setup lang="ts">
import CTA from "../components/CTA.vue";
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
        <mcw-button outlined>LinkedIn</mcw-button>
      </a>
      <a href="mailto:bonjour@arthurmoug.in" target="_blank" rel="noopener noreferrer">
        <mcw-button outlined>Email</mcw-button>
      </a>

    </div>
  </footer>
</template>

<style scoped>
article {
  padding: 4em 2rem;
}

article h1 {
  font-size: 2em;
}

article h2 {
  font-size: 1.75em;
}

article:not(:first-child)>* {
  max-width: 500px;
}

article:not(:first-child):nth-child(2n + 1) {
  text-align: end;
  /* right: 0; */
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

article#main {
  text-align: center;
  display: flex;
  align-items: center;
  flex-direction: column;
}

li {
  margin: 1rem 0;
}

article h2 {
  color: var(--accent);
}

footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--mdc-theme-on-primary);
  color: white;
}

footer div {
  display: flex;
  flex-direction: row;
  align-items: center;
}

footer div a {
  margin: 0 0.5rem;
}

footer .mdc-button--outlined {
  --text: var(--primary);
  --mdc-outlined-button-outline-color: var(--primary);
}
</style>
