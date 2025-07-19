<script setup lang="ts">
import { useAuthStore } from '../store/auth.store';
</script>

<template>
    <div>
        <mcw-button id="test" raised @click="useAuthStore().login">Try Figma-xr Now</mcw-button>
        <p>or</p>
        <a href="https://www.linkedin.com/in/arthur-mougin/"><mcw-button id="hire" raised>Get in touch</mcw-button></a>
    </div>
</template>

<style scoped>
div {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
}

p {
    padding: 1rem;
}

#test {
    background-color: var(--mdc-theme-secondary);
}

#hire {
    background-color: var(--mdc-theme-accent);
    --text: white;
}
</style>