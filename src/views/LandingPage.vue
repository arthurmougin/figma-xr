<script setup lang="ts">
    import CTA from '../components/CTA.vue';
    defineProps<{
        login:()=>void
    }>()
</script>

<template>
    <article id="main">
        <h1>Figma-xr: Elevate Your Design Prototyping into the XR Realm</h1>
        <CTA :login="login"></CTA> 
    </article>
    <article id="description">
        <h2>What is Figma-xr?</h2>
        <p>Figma-xr is an open-source tool that seamlessly integrates Figma with XR, enabling immersive UI prototyping like never before.</p>
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
        <h2>How to Use</h2>
        <ol>
            <li>Connect to Figma</li>
            <li>Add any project</li>
            <li>Open the one of your choosing</li>
            <li>Place panels in XR !</li>
        </ol>
    </article>
    <footer>
        <CTA :login="login"></CTA> 

        //Connect on social media
        <div>
            <a href="https://twitter.com/figmaxr" target="_blank" rel="noopener noreferrer">
                <mcw-icon-button icon="twitter"></mcw-icon-button>
            </a>
            <a href="linkedin.com/in/figma-xr" target="_blank" rel="noopener noreferrer">
                <mcw-icon-button icon="linkedin"></mcw-icon-button>
            </a>
        </div>

    </footer>
</template>

<style scoped>
    article {
        padding: 4em 2rem;
    }

    article:not(:first-child) > * {
        max-width: 500px;
    }

    article:not(:first-child):nth-child(2n +1) {
        text-align: end;
        /* right: 0; */
        display: flex;
        flex-direction: column;
        align-items: flex-end;
    }

    li {
        margin: 1rem 0;
    }

    article h2 {
        color:var(--accent)
    }

    footer {
        display: flex;
        flex-direction: column;
        align-items: center;
        background : var(--mdc-theme-on-primary);
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
</style>